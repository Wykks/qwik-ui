import {
  component$,
  Slot,
  type PropsOf,
  useSignal,
  useContextProvider,
  Signal,
  useTask$,
  useComputed$,
  type QRL,
  useId,
} from '@builder.io/qwik';
import { type SelectContext } from './select-context';
import SelectContextId from './select-context';
import { Opt } from './select-inline';
import { isBrowser } from '@builder.io/qwik/build';
import { getActiveDescendant } from './utils';

export type InternalSelectProps = {
  /** Our source of truth for the options. We get this at pre-render time in the inline component, that way we do not need to call native methods such as textContent.
   **/
  _options?: Opt[];

  /** When a value is passed, we check if it's an actual option value, and get its index at pre-render time.
   **/
  _valuePropIndex?: number | null;
};

export type SelectProps = PropsOf<'div'> & {
  /** The initial selected value (uncontrolled). */
  value?: string;

  /** A signal that contains the current selected value (controlled). */
  'bind:value'?: Signal<string>;

  /**
   * QRL handler that runs when a select value changes.
   * @param value The new value as a string.
   */
  onChange$?: QRL<(value: string) => void>;

  /**
   * QRL handler that runs when the listbox opens or closes.
   * @param open The new state of the listbox.
   *
   */
  onOpenChange$?: QRL<(open: boolean) => void>;

  /**
   *  The native scrollIntoView method is used to scroll the options into view when the user highlights an option. This allows customization of the scroll behavior.
   */
  scrollOptions?: ScrollIntoViewOptions;

  /**
   *  Enables looped behavior when the user navigates through the options using the arrow keys.
   */
  loop?: boolean;
};

/* root component in select-inline.tsx */
export const SelectImpl = component$<SelectProps & InternalSelectProps>(
  (props: SelectProps & InternalSelectProps) => {
    const {
      _options,
      _valuePropIndex: givenValuePropIndex,
      onChange$,
      onOpenChange$,
      scrollOptions: givenScrollOptions,
      loop: givenLoop,
      ...rest
    } = props;

    // refs
    const rootRef = useSignal<HTMLDivElement>();
    const triggerRef = useSignal<HTMLButtonElement>();
    const popoverRef = useSignal<HTMLElement>();
    const listboxRef = useSignal<HTMLUListElement>();
    const groupRef = useSignal<HTMLDivElement>();
    const loop = givenLoop ?? false;
    const localId = useId();
    const listboxId = `${localId}-listbox`;

    /**
     * Updates the options when the options change
     * (for example, when a new option is added)
     **/
    const optionsSig = useComputed$(() => {
      if (_options === undefined || _options.length === 0) {
        return [];
      }
      return _options;
    });

    const optionsIndexMap = new Map(
      optionsSig.value?.map((option, index) => [option.value, index]),
    );

    // core state
    const selectedIndexSig = useSignal<number | null>(givenValuePropIndex ?? null);
    const highlightedIndexSig = useSignal<number | null>(givenValuePropIndex ?? null);
    const isListboxOpenSig = useSignal<boolean>(false);
    const scrollOptions = givenScrollOptions ?? {
      behavior: 'instant',
      block: 'nearest',
    };

    // Maps are apparently great for this index accessing. Will learn more about them this week and refactor this to have a more consistent API and eliminate redundancy / duplication.
    useTask$(function controlledValueTask({ track }) {
      const controlledValue = track(() => props['bind:value']?.value);
      if (!controlledValue) return;

      const matchingIndex = optionsIndexMap.get(controlledValue) ?? -1;
      if (matchingIndex !== -1) {
        selectedIndexSig.value = matchingIndex;
        highlightedIndexSig.value = matchingIndex;
      }
    });

    // onChange$

    useTask$(async function onChangeTask({ track }) {
      track(() => selectedIndexSig.value);
      if (isBrowser && selectedIndexSig.value !== null) {
        await onChange$?.(optionsSig.value[selectedIndexSig.value].value);
      }
    });

    useTask$(function onOpenChangeTask({ track }) {
      track(() => isListboxOpenSig.value);

      if (isBrowser) {
        onOpenChange$?.(isListboxOpenSig.value);
      }
    });

    const context: SelectContext = {
      triggerRef,
      popoverRef,
      listboxRef,
      groupRef,
      optionsSig,
      localId,
      highlightedIndexSig,
      selectedIndexSig,
      isListboxOpenSig,
      scrollOptions,
      loop,
    };

    useContextProvider(SelectContextId, context);

    return (
      <div
        role="combobox"
        ref={rootRef}
        data-open={context.isListboxOpenSig.value ? '' : undefined}
        data-closed={!context.isListboxOpenSig.value ? '' : undefined}
        aria-activedescendant={
          context.isListboxOpenSig.value
            ? getActiveDescendant(
                context.highlightedIndexSig.value ?? -1,
                context.optionsSig.value,
                context.localId,
              )
            : ''
        }
        aria-controls={listboxId}
        aria-expanded={context.isListboxOpenSig.value}
        aria-haspopup="listbox"
        {...rest}
      >
        <Slot />
      </div>
    );
  },
);

/*
 * Copyright 2017 Palantir Technologies, Inc. All rights reserved.
 * Licensed under the BSD-3 License as modified (the “License”); you may obtain a copy
 * of the license at https://github.com/palantir/blueprint/blob/master/LICENSE
 * and https://github.com/palantir/blueprint/blob/master/PATENTS
 */

import * as classNames from "classnames";
import * as moment from "moment";
import * as React from "react";

import {
    AbstractComponent,
    Classes,
    IInputGroupProps,
    InputGroup,
    Intent,
    IProps,
    Popover,
    Position,
    Utils,
} from "@blueprintjs/core";

import {
    DateRange,
    fromDateRangeToMomentDateRange,
    fromMomentDateRangeToDateRange,
    fromMomentToDate,
    isMomentInRange,
    isMomentNull,
    isMomentValidAndInRange,
    MomentDateRange,
} from "./common/dateUtils";
import {
    getDefaultMaxDate,
    getDefaultMinDate,
    IDatePickerBaseProps,
} from "./datePickerCore";
import {
    DateRangePicker,
} from "./dateRangePicker";

export interface IDateRangeInputProps extends IDatePickerBaseProps, IProps {

    /**
     * The default date range to be used in the component when uncontrolled.
     * This will be ignored if `value` is set.
     */
    defaultValue?: DateRange;

    /**
     * Props to pass to the end-date input.
     */
    endInputProps?: IInputGroupProps;

    /**
     * The format of each date in the date range. See options
     * here: http://momentjs.com/docs/#/displaying/format/
     * @default "YYYY-MM-DD"
     */
    format?: string;

    /**
     * The error message to display when the selected date is invalid.
     * @default "Invalid date"
     */
    invalidDateMessage?: string;

    /**
     * Called when the user selects a day.
     * If no days are selected, it will pass `[null, null]`.
     * If a start date is selected but not an end date, it will pass `[selectedDate, null]`.
     * If both a start and end date are selected, it will pass `[startDate, endDate]`.
     */
    onChange?: (selectedRange: DateRange) => void;

    /**
     * Called when the user finishes typing in a new date and the date causes an error state.
     * If the date is invalid, `new Date(undefined)` will be returned for the corresponding
     * boundary of the date range.
     * If the date is out of range, the out-of-range date will be returned for the corresponding
     * boundary of the date range (`onChange` is not called in this case).
     */
    onError?: (errorRange: DateRange) => void;

    /**
     * The error message to display when the date selected is out of range.
     * @default "Out of range"
     */
    outOfRangeMessage?: string;

    /**
     * Props to pass to the start-date input.
     */
    startInputProps?: IInputGroupProps;

    /**
     * The currently selected date range.
     * If this prop is present, the component acts in a controlled manner.
     * To display no date range in the input fields, pass `[null, null]` to the value prop.
     * To display an invalid date error in either input field, pass `new Date(undefined)`
     * for the appropriate date in the value prop.
     */
    value?: DateRange;
}

export interface IDateRangeInputState {
    isOpen?: boolean;

    isStartInputFocused?: boolean;
    isEndInputFocused?: boolean;

    startInputString?: string;
    endInputString?: string;

    selectedEnd?: moment.Moment;
    selectedStart?: moment.Moment;
};

interface IStateKeysAndValuesObject {
    keys: {
        inputString: "startInputString" | "endInputString";
        isInputFocused: "isStartInputFocused" | "isEndInputFocused";
        selectedValue: "selectedStart" | "selectedEnd";
    };
    values: {
        controlledValue?: moment.Moment,
        inputString?: string;
        isInputFocused?: boolean;
        selectedValue?: moment.Moment;
    };
};

export enum DateRangeBoundary {
    START,
    END,
};

export class DateRangeInput extends AbstractComponent<IDateRangeInputProps, IDateRangeInputState> {
    public static defaultProps: IDateRangeInputProps = {
        endInputProps: {},
        format: "YYYY-MM-DD",
        invalidDateMessage: "Invalid date 2",
        maxDate: getDefaultMaxDate(),
        minDate: getDefaultMinDate(),
        outOfRangeMessage: "Out of range",
        startInputProps: {},
    };

    private static ERROR_CLASS = Classes.intentClass(Intent.DANGER);

    public displayName = "Blueprint.DateRangeInput";

    private startInputRef: HTMLInputElement;
    private endInputRef: HTMLInputElement;
    private refHandlers = {
        endInputRef: (ref: HTMLInputElement) => {
            this.endInputRef = ref;
            Utils.safeInvoke(this.props.endInputProps.inputRef, ref);
        },
        startInputRef: (ref: HTMLInputElement) => {
            this.startInputRef = ref;
            Utils.safeInvoke(this.props.startInputProps.inputRef, ref);
        },
    };

    public constructor(props: IDateRangeInputProps, context?: any) {
        super(props, context);

        const [selectedStart, selectedEnd] = this.getInitialRange();

        this.state = {
            isOpen: false,
            selectedEnd,
            selectedStart,
        };
    }

    public render() {
        const { startInputProps, endInputProps } = this.props;

        const startInputString = this.getInputDisplayString(DateRangeBoundary.START);
        const endInputString = this.getInputDisplayString(DateRangeBoundary.END);

        const popoverContent = (
            <DateRangePicker
                onChange={this.handleDateRangePickerChange}
                maxDate={this.props.maxDate}
                minDate={this.props.minDate}
                value={this.getSelectedRange()}
            />
        );

        const startInputClasses = classNames(startInputProps.className, {
            [DateRangeInput.ERROR_CLASS]: this.isInputInErrorState(DateRangeBoundary.START),
        });
        const endInputClasses = classNames(endInputProps.className, {
            [DateRangeInput.ERROR_CLASS]: this.isInputInErrorState(DateRangeBoundary.END),
        });

        // allow custom props for each input group, but pass them in an order
        // that guarantees only some props are overridable.
        return (
            <Popover
                autoFocus={false}
                content={popoverContent}
                enforceFocus={false}
                inline={true}
                isOpen={this.state.isOpen}
                onClose={this.handlePopoverClose}
                position={Position.TOP_LEFT}
            >
                <div className={Classes.CONTROL_GROUP}>
                    <InputGroup
                        placeholder="Start date"
                        {...startInputProps}
                        className={startInputClasses}
                        inputRef={this.refHandlers.startInputRef}
                        onBlur={this.handleStartInputBlur}
                        onChange={this.handleStartInputChange}
                        onClick={this.handleInputClick}
                        onFocus={this.handleStartInputFocus}
                        value={startInputString}
                    />
                    <InputGroup
                        placeholder="End date"
                        {...endInputProps}
                        className={endInputClasses}
                        inputRef={this.refHandlers.endInputRef}
                        onBlur={this.handleEndInputBlur}
                        onChange={this.handleEndInputChange}
                        onClick={this.handleInputClick}
                        onFocus={this.handleEndInputFocus}
                        value={endInputString}
                    />
                </div>
            </Popover>
        );
    }

    public componentWillReceiveProps(nextProps: IDateRangeInputProps) {
        super.componentWillReceiveProps(nextProps);
        if (nextProps.value !== this.props.value) {
            const [selectedStart, selectedEnd] = this.getInitialRange(nextProps);
            this.setState({ selectedStart, selectedEnd });
        }
    }

    // Callbacks - DateRangePicker
    // ===========================

    private handleDateRangePickerChange = (selectedRange: DateRange) => {
        if (this.props.value === undefined) {
            const [selectedStart, selectedEnd] = fromDateRangeToMomentDateRange(selectedRange);
            this.setState({ selectedStart, selectedEnd });
        }
        Utils.safeInvoke(this.props.onChange, selectedRange);
    }

    // Callbacks - Input
    // =================

    // Click

    private handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
        // unless we stop propagation on this event, a click within an input
        // will close the popover almost as soon as it opens.
        e.stopPropagation();
    }

    // Focus

    private handleStartInputFocus = (e: React.FormEvent<HTMLInputElement>) => {
        this.handleInputFocus(e, DateRangeBoundary.START);
    }

    private handleEndInputFocus = (e: React.FormEvent<HTMLInputElement>) => {
        this.handleInputFocus(e, DateRangeBoundary.END);
    }

    private handleInputFocus = (_e: React.FormEvent<HTMLInputElement>, boundary: DateRangeBoundary) => {
        const { keys, values } = this.getStateKeysAndValuesForBoundary(boundary);
        const inputString = this.getFormattedDateString(values.selectedValue);

        this.setState({
            isOpen: true,
            [keys.inputString]: inputString,
            [keys.isInputFocused]: true,
        });
    }

    // Blur

    private handleStartInputBlur = (e: React.FormEvent<HTMLInputElement>) => {
        this.handleInputBlur(e, DateRangeBoundary.START);
    }

    private handleEndInputBlur = (e: React.FormEvent<HTMLInputElement>) => {
        this.handleInputBlur(e, DateRangeBoundary.END);
    }

    private handleInputBlur = (_e: React.FormEvent<HTMLInputElement>, boundary: DateRangeBoundary) => {
        const { keys, values } = this.getStateKeysAndValuesForBoundary(boundary);

        const maybeNextValue = this.dateStringToMoment(values.inputString);
        const isValueControlled = this.isControlled();

        if (values.inputString == null || values.inputString.length === 0) {
            if (isValueControlled) {
                this.setState({
                    [keys.isInputFocused]: false,
                    [keys.inputString]: this.getFormattedDateString(values.controlledValue),
                });
            } else {
                this.setState({
                    [keys.isInputFocused]: false,
                    [keys.selectedValue]: moment(null),
                    [keys.inputString]: null,
                });
            }
        } else if (!this.isMomentValidAndInRange(maybeNextValue)) {
            if (isValueControlled) {
                this.setState({ [keys.isInputFocused]: false });
            } else {
                this.setState({
                    [keys.isInputFocused]: false,
                    [keys.inputString]: null,
                    [keys.selectedValue]: maybeNextValue,
                });

                // TODO: if end date invalid, invoke onError with...?
                if (this.isMomentValidAndInRange(maybeNextValue)) {
                    // TODO: invoke onChange with...?
                } else {
                    const errorRange = this.getRangeForErrorCallback(maybeNextValue, boundary);
                    Utils.safeInvoke(this.props.onError, errorRange);
                }
            }
        } else {
            this.setState({ [keys.isInputFocused]: false });
        }
    }

    // Change

    private handleStartInputChange = (e: React.FormEvent<HTMLInputElement>) => {
        this.handleInputChange(e, DateRangeBoundary.START);
    }

    private handleEndInputChange = (e: React.FormEvent<HTMLInputElement>) => {
        this.handleInputChange(e, DateRangeBoundary.END);
    }

    private handleInputChange = (e: React.FormEvent<HTMLInputElement>, boundary: DateRangeBoundary) => {
        const inputString = (e.target as HTMLInputElement).value;

        const { keys } = this.getStateKeysAndValuesForBoundary(boundary);
        const maybeNextValue = this.dateStringToMoment(inputString);
        const isValueControlled = this.isControlled();

        if (inputString.length === 0) {
            // this case will be relevant when we start showing the hovered
            // range in the input fields. goal is to show an empty field for
            // clarity until the mouse moves over a different date.
            if (isValueControlled) {
                this.setState({ [keys.inputString]: "" });
            } else {
                this.setState({ [keys.inputString]: "", [keys.selectedValue]: moment(null) });
            }
            Utils.safeInvoke(this.props.onChange, [null, null] as DateRange);
        } else if (this.isMomentValidAndInRange(maybeNextValue)) {
            if (isValueControlled) {
                this.setState({ [keys.inputString]: inputString });
            } else {
                this.setState({ [keys.inputString]: inputString, [keys.selectedValue]: maybeNextValue });
            }

            const nextMomentDateRange: MomentDateRange = (boundary === DateRangeBoundary.START)
                ? [maybeNextValue, this.state.selectedEnd]
                : [this.state.selectedStart, maybeNextValue];

            Utils.safeInvoke(this.props.onChange, fromMomentDateRangeToDateRange(nextMomentDateRange));
        } else {
            this.setState({ [keys.inputString]: inputString });
        }
    }

    // Callbacks - Popover
    // ===================

    private handlePopoverClose = () => {
        this.setState({ isOpen: false });
    }

    // Helpers
    // =======

    private dateStringToMoment = (dateString: String) => {
        return moment(dateString, this.props.format);
    }

    private getInitialRange = (props = this.props) => {
        const { defaultValue, value } = props;
        if (value != null) {
            return fromDateRangeToMomentDateRange(value);
        } else if (defaultValue != null) {
            return fromDateRangeToMomentDateRange(defaultValue);
        } else {
            return [moment(null), moment(null)] as MomentDateRange;
        }
    }

    private getSelectedRange = () => {
        return [this.state.selectedStart, this.state.selectedEnd].map((selectedBound?: moment.Moment) => {
            return this.isMomentValidAndInRange(selectedBound)
                ? fromMomentToDate(selectedBound)
                : undefined;
        }) as DateRange;
    }

    private getInputDisplayString = (boundary: DateRangeBoundary) => {
        const { values } = this.getStateKeysAndValuesForBoundary(boundary);
        const { isInputFocused, inputString, selectedValue } = values;

        const isValid = selectedValue.isValid();

        // these cases are handled the same whether or not the field is focused
        if (isMomentNull(selectedValue)) {
            return "";
        } else if (!isValid) {
            return this.props.invalidDateMessage;
        }

        // break out the following if/else logic to make the code easier to grok
        if (isInputFocused) {
            return inputString;
        } else {
            if (!this.isMomentInRange(selectedValue)) {
                return this.props.outOfRangeMessage;
            } else {
                return this.getFormattedDateString(selectedValue);
            }
        }
    }

    private getFormattedDateString = (momentDate: moment.Moment) => {
        if (isMomentNull(momentDate)) {
            return "";
        } else {
            return momentDate.format(this.props.format);
        }
    }

    private getStateKeysAndValuesForBoundary = (boundary: DateRangeBoundary) => {
        const controlledRange = fromDateRangeToMomentDateRange(this.props.value);
        if (boundary === DateRangeBoundary.START) {
            return {
                keys: {
                    inputString: "startInputString",
                    isInputFocused: "isStartInputFocused",
                    selectedValue: "selectedStart",
                },
                values: {
                    controlledValue: (controlledRange != null) ? controlledRange[0] : undefined,
                    inputString: this.state.startInputString,
                    isInputFocused: this.state.isStartInputFocused,
                    selectedValue: this.state.selectedStart,
                },
            } as IStateKeysAndValuesObject;
        } else {
            return {
                keys: {
                    inputString: "endInputString",
                    isInputFocused: "isEndInputFocused",
                    selectedValue: "selectedEnd",
                },
                values: {
                    controlledValue: (controlledRange != null) ? controlledRange[1] : undefined,
                    inputString: this.state.endInputString,
                    isInputFocused: this.state.isEndInputFocused,
                    selectedValue: this.state.selectedEnd,
                },
            } as IStateKeysAndValuesObject;
        }
    }

    private getRangeForErrorCallback = (errorValue?: moment.Moment, errorBoundary?: DateRangeBoundary) => {
        const otherBoundary = this.getOtherBoundary(errorBoundary);
        const otherValue = this.getStateKeysAndValuesForBoundary(otherBoundary).values.selectedValue;

        const errorDate = this.getDateForErrorCallback(errorValue);
        const otherDate = this.getDateForErrorCallback(otherValue);

        return (errorBoundary === DateRangeBoundary.START)
            ? [errorDate, otherDate]
            : [otherDate, errorDate];
    }

    private getDateForErrorCallback = (momentDate: moment.Moment) => {
        if (!momentDate.isValid()) {
            return new Date(undefined);
        } else {
            return fromMomentToDate(momentDate);
        }
    }

    private getOtherBoundary = (boundary?: DateRangeBoundary) => {
        return (boundary === DateRangeBoundary.START) ? DateRangeBoundary.END : DateRangeBoundary.START;
    }

    private isControlled = () => {
        return this.props.value !== undefined;
    }

    private isInputEmpty = (inputString: string) => {
        return inputString == null || inputString.length === 0;
    }

    private isInputInErrorState = (boundary: DateRangeBoundary) => {
        const { values } = this.getStateKeysAndValuesForBoundary(boundary);
        const { isInputFocused, inputString, selectedValue } = values;

        if (isInputFocused) {
            return !this.isInputEmpty(inputString)
                && !this.isMomentValidAndInRange(this.dateStringToMoment(inputString));
        } else {
            return !isMomentNull(selectedValue) && !this.isMomentValidAndInRange(selectedValue);
        }
    }

    private isMomentValidAndInRange = (momentDate: moment.Moment) => {
        return isMomentValidAndInRange(momentDate, this.props.minDate, this.props.maxDate);
    }

    private isMomentInRange = (momentDate: moment.Moment) => {
        return isMomentInRange(momentDate, this.props.minDate, this.props.maxDate);
    }
}

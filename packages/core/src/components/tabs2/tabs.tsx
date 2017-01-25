/*
 * Copyright 2015 Palantir Technologies, Inc. All rights reserved.
 * Licensed under the BSD-3 License as modified (the “License”); you may obtain a copy
 * of the license at https://github.com/palantir/blueprint/blob/master/LICENSE
 * and https://github.com/palantir/blueprint/blob/master/PATENTS
 */

import * as classNames from "classnames";
import * as PureRender from "pure-render-decorator";
import * as React from "react";
// import { findDOMNode } from "react-dom";

import { AbstractComponent } from "../../common/abstractComponent";
import * as Classes from "../../common/classes";
import * as Keys from "../../common/keys";
import { IProps } from "../../common/props";
import { safeInvoke } from "../../common/utils";

import { ITabProps, Tab, TabId } from "./tab";
import { TabTitle } from "./TabTitle";

// <Tabs>
//     <Tab title="Alpha">
//         <h1>first panel</h1>
//     </Tab>
//     <Tab title="Beta">
//         <h1>second panel</h1>
//     </Tab>
//     <input type="text" placeholder="Search..." />
// </Tabs>

// TODO
// `renderActiveTabPanelOnly`
// vertical key bindings? up/dn
// correct aria-* props support (needs unique IDs in DOM?)

type TabElement = React.ReactElement<ITabProps & { children: React.ReactNode }>;

const TAB_SELECTOR = `.${Classes.TAB}`;

export interface ITabsProps extends IProps {
    /**
     * Whether the selected tab indicator should animate its movement.
     * @default true
     */
    animate?: boolean;

    /**
     * Initial selected tab `id`. Note that this prop refers only to `<Tab>` children;
     * other types of elements are ignored.
     * @default first tab
     */
    defaultSelectedTabId?: TabId;

    /**
     * Whether inactive tab panels should be removed from the DOM and unmounted in React.
     * This can be a helpful performance enhancement but requires careful support for
     * unmounting and remounting properly.
     * @default false
     */
    renderActiveTabPanelOnly?: boolean;

    /**
     * Whether to show tabs stacked vertically on the left side.
     * @default false
     */
    vertical?: boolean;

    /**
     * A callback function that is invoked when tabs in the tab list are clicked.
     */
    onChange?(selectedTabId: TabId, prevSelectedTabIndex: TabId): void;
}

export interface ITabsState {
    indicatorWrapperStyle?: React.CSSProperties;
    selectedTabId?: TabId;
}

@PureRender
export class Tabs extends AbstractComponent<ITabsProps, ITabsState> {
    public static defaultProps: ITabsProps = {
        animate: true,
        renderActiveTabPanelOnly: false,
        vertical: false,
    };

    public displayName = "Blueprint.Tabs2";

    private tabElement: HTMLDivElement;

    constructor(props?: ITabsProps, context?: any) {
        super(props, context);
        // select first tab in absence of user input
        const selectedTabId = props.defaultSelectedTabId == null
            ? this.getTabChildren()[0].props.id
            : props.defaultSelectedTabId;
        this.state = { selectedTabId };
    }

    public render() {
        const { indicatorWrapperStyle, selectedTabId } = this.state;

        const tabTitles = React.Children.map(this.props.children, (child) => {
            if (isTab(child)) {
                const { id } = child.props;
                return (
                    <TabTitle
                        {...child.props}
                        onClick={this.getTabClickHandler(id)}
                        selected={id === selectedTabId}
                    />
                );
            } else {
                // TabTitle renders an <li> so let's do the same here
                return <li>{child}</li>;
            }
        });

        const tabPanels = this.getTabChildren()
            .filter(this.props.renderActiveTabPanelOnly ? (tab) => tab.props.id === selectedTabId : () => true)
            .map(this.renderTabPanel);

        const tabIndicator = (
            <div className="pt-tab-indicator-wrapper" style={indicatorWrapperStyle}>
                <div className="pt-tab-indicator" />
            </div>
        );

        const classes = classNames(Classes.TABS, { "pt-vertical": this.props.vertical }, this.props.className);
        return (
            <div className={classes}>
                <div
                    className={Classes.TAB_LIST}
                    onKeyDown={this.handleKeyDown}
                    onKeyPress={this.handleKeyPress}
                    ref={this.handleTabRef}
                    role="tablist"
                >
                    {this.props.animate ? tabIndicator : undefined}
                    {tabTitles}
                </div>
                {tabPanels}
            </div>
        );
    }

    public componentDidMount() {
        this.moveSelectionIndicator();
    }

    public componentDidUpdate(_: ITabsProps, prevState: ITabsState) {
        if (this.state.selectedTabId !== prevState.selectedTabId) {
            this.moveSelectionIndicator();
        }
    }

    /** Filters this.props.children to only `<Tab>`s */
    private getTabChildren() {
        return React.Children.toArray(this.props.children).filter(isTab) as TabElement[];
    }

    /** Queries root HTML element for all `.pt-tab`s with optional filter selector */
    private getTabElements(subselector = "") {
        if (this.tabElement == null) {
            return [] as Elements;
        }
        return this.tabElement.queryAll(TAB_SELECTOR + subselector);
    }

    private getTabClickHandler(selectedTabId: TabId) {
        return () => {
            if (selectedTabId !== this.state.selectedTabId) {
                safeInvoke(this.props.onChange, selectedTabId, this.state.selectedTabId);
                this.setState({ selectedTabId });
            }
        };
    }

    private handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const focusedElement = document.activeElement.closest(TAB_SELECTOR);
        // rest of this is potentially expensive and futile, so bail if no tab is focused
        if (focusedElement == null) { return; }

        // must rely on DOM state because we have no way of mapping `focusedElement` to a JSX.Element
        const enabledTabElements = this.getTabElements()
            .filter((el) => el.getAttribute("aria-disabled") === "false");
        // .indexOf(undefined) => -1 which we handle later
        const focusedIndex = enabledTabElements.indexOf(focusedElement);

        if (focusedIndex >= 0 && isEventKeyCode(e, Keys.ARROW_LEFT, Keys.ARROW_RIGHT)) {
            // UP keycode is between LEFT and RIGHT so this produces 1 | -1
            const direction = e.which - Keys.ARROW_UP;
            const { length } = enabledTabElements;
            // auto-wrapping at 0 and `length`
            const nextFocusedIndex = (focusedIndex + direction + length) % length;
            (enabledTabElements[nextFocusedIndex] as HTMLElement).focus();
        }
    }

    private handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const targetTabElement = (e.target as HTMLElement).closest(TAB_SELECTOR) as HTMLElement;
        if (targetTabElement != null && isEventKeyCode(e, Keys.SPACE, Keys.ENTER)) {
            e.preventDefault();
            targetTabElement.click();
        }
    }

    private handleTabRef = (tabElement: HTMLDivElement) => { this.tabElement = tabElement; };

    /**
     * Calculate the new height, width, and position of the tab indicator.
     * Store the CSS values so the transition animation can start.
     */
    private moveSelectionIndicator() {
        const tabIdSelector = `${TAB_SELECTOR}[data-tab-id="${this.state.selectedTabId}"]`;
        const selectedTabElement = this.tabElement.query(tabIdSelector) as HTMLElement;
        const { clientHeight, clientWidth, offsetLeft, offsetTop } = selectedTabElement;
        const indicatorWrapperStyle = {
            height: clientHeight,
            transform: `translateX(${Math.floor(offsetLeft)}px) translateY(${Math.floor(offsetTop)}px)`,
            width: clientWidth,
        };
        this.setState({ indicatorWrapperStyle });
    }

    private renderTabPanel = (tab: TabElement) => {
        const { className, children, id } = tab.props;
        return (
            <div
                aria-labelledby=""
                aria-hidden={id !== this.state.selectedTabId}
                className={classNames(Classes.TAB_PANEL, className)}
                data-tab-id={id}
                key={id}
                role="tabpanel"
            >
                {children}
            </div>
        );
    }
}

export const TabsFactory = React.createFactory(Tabs);

function isEventKeyCode(e: React.KeyboardEvent<HTMLElement>, ...codes: number[]) {
    return codes.indexOf(e.which) >= 0;
}

function isTab(child: React.ReactChild): child is TabElement {
    return (child as JSX.Element).type === Tab;
}
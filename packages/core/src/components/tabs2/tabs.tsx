/*
 * Copyright 2015 Palantir Technologies, Inc. All rights reserved.
 * Licensed under the BSD-3 License as modified (the “License”); you may obtain a copy
 * of the license at https://github.com/palantir/blueprint/blob/master/LICENSE
 * and https://github.com/palantir/blueprint/blob/master/PATENTS
 */

import * as classNames from "classnames";
import * as PureRender from "pure-render-decorator";
import * as React from "react";

import { AbstractComponent } from "../../common/abstractComponent";
import * as Classes from "../../common/classes";
import { IProps } from "../../common/props";
import { safeInvoke} from "../../common/utils"

import { ITabProps, Tab } from "./tab";
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

export interface ITabsProps extends IProps {
    /**
     * Whether to show tabs stacked vertically on the left side.
     * @default false
     */
    vertical?: boolean;

    /**
     * A callback function that is invoked when tabs in the tab list are clicked.
     */
    onChange?(selectedTabIndex: number, prevSelectedTabIndex: number): void;
}

export interface ITabsState {
    /**
     * The list of CSS rules to use on the indicator wrapper of the tab list.
     */
    indicatorWrapperStyle?: React.CSSProperties;

    /**
     * The index of the currently selected tab.
     * If a prop with the same name is set, this bit of state simply aliases the prop.
     */
    selectedTabIndex?: number;
}

type TabElement = React.ReactElement<ITabProps & { children: React.ReactNode }>;

function isTab(child: React.ReactChild): child is TabElement {
    return (child as JSX.Element).type === Tab;
}

@PureRender
export class Tabs extends AbstractComponent<ITabsProps, ITabsState> {
    public static defaultProps: ITabsProps = {
        vertical: false,
    };

    public displayName = "Blueprint.Tabs";
    // state is initialized in the constructor but getStateFromProps needs state defined
    public state: ITabsState = {
        selectedTabIndex: 0,
    };

    constructor(props?: ITabsProps, context?: any) {
        super(props, context);
    }

    public render() {
        const { selectedTabIndex } = this.state;
        // separate counter to only include Tab-type children
        let index = -1;
        const tabs = React.Children.map(this.props.children, (child) => {
            index++;
            if (isTab(child)) {
                return <TabTitle
                    {...child.props}
                    onClick={this.getClickHandler(index)}
                    selected={index === selectedTabIndex}
                />;
            } else {
                return <li>{child}</li>;
            }
        });
        const classes = classNames(Classes.TABS, { "pt-vertical": this.props.vertical }, this.props.className);
        return (
            <div className={classes}>
                <div className={Classes.TAB_LIST} role="tablist">{tabs}</div>
                {this.getTabChildren()[selectedTabIndex]}
            </div>
        );
    }

    private getTabChildren() {
        return React.Children.toArray(this.props.children).filter(isTab) as TabElement[];
    }

    private getClickHandler(selectedTabIndex: number) {
        return () => {
            safeInvoke(this.props.onChange, selectedTabIndex, this.state.selectedTabIndex);
            this.setState({ selectedTabIndex });
        }
    }
}

export const TabsFactory = React.createFactory(Tabs);
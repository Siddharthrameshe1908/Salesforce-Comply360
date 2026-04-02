import { LightningElement, api, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getActivities from '@salesforce/apex/ClauseActivityController.getActivities';
// import createTask from '@salesforce/apex/ClauseActivityController.createTask';
import getTaskSubjectOptions from '@salesforce/apex/ClauseActivityController.getTaskSubjectOptions';
import getAssignableUsers from '@salesforce/apex/ClauseActivityController.getAssignableUsers';

export default class ClauseActivityPanel extends LightningElement {
    _recordId;

    @track isLoading = false;
    @track allItems = [];
    @track isFilterPanelOpen = false;
    @track isUpcomingSectionOpen = true;
    @track showAllHistory = false;
    @track areAllExpanded = false;
    // @track isNewTaskModalOpen = false;
    // @track subjectOptions = [];
    // @track ownerOptions = [];

    // @track newTask = {
    //     subject: '',
    //     activityDate: null,
    //     status: 'Not Started',
    //     priority: 'Normal',
    //     description: '',
    //     ownerId: ''
    // };

    filters = {
        dateRange: 'all',
        activityScope: 'all',
        includeTasks: true,
        includeEvents: true,
        includeAllTypes: true,
        includeLoggedCalls: true,
        includeEmail: true,
        includeWeb: true,
        includeListEmail: true,
        sortDirection: 'newest'
    };

    @track draftFilters = {
        dateRange: 'all',
        activityScope: 'all',
        includeTasks: true,
        includeEvents: true,
        includeAllTypes: true,
        includeLoggedCalls: true,
        includeEmail: true,
        includeWeb: true,
        includeListEmail: true,
        sortDirection: 'newest'
    };

    wiredActivitiesResult;

    @api
    get recordId() {
        return this._recordId;
    }

    set recordId(value) {
        this._recordId = value;
        this.isLoading = Boolean(value);
    }

    @wire(getActivities, { recordId: '$_recordId' })
    wiredActivities(result) {
        this.wiredActivitiesResult = result;

        const { data, error } = result;
        if (!data && !error) {
            this.isLoading = Boolean(this._recordId);
            return;
        }

        if (data) {
            this.allItems = data.map((item) => this.normalizeItem(item));
        } else if (error) {
            this.allItems = [];
            console.error('Error loading activities', error);
        }

        this.isLoading = false;
    }

    // @wire(getTaskSubjectOptions)
    // wiredTaskSubjectOptions({ data, error }) {
    //     if (data) {
    //         this.subjectOptions = data.map((value) => ({
    //             label: value,
    //             value
    //         }));
    //     } else if (error) {
    //         this.subjectOptions = [];
    //         console.error('Error loading task subject options', error);
    //     }
    // }

    // @wire(getAssignableUsers)
    // wiredAssignableUsers({ data, error }) {
    //     if (data) {
    //         this.ownerOptions = data.map((item) => ({
    //             label: item.label,
    //             value: item.value
    //         }));
    //     } else if (error) {
    //         this.ownerOptions = [];
    //         console.error('Error loading assignable users', error);
    //     }
    // }

    normalizeItem(item) {
        const dt = item.activityDateTime ? new Date(item.activityDateTime) : null;
        const d = item.activityDate ? new Date(`${item.activityDate}T00:00:00`) : null;

        let effectiveDate = null;
        if (dt) {
            effectiveDate = dt;
        } else if (d) {
            effectiveDate = d;
        }

        const monthLabel = effectiveDate
            ? effectiveDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
            : 'No Date';

        return {
            ...item,
            effectiveDate,
            monthLabel,
            iconName: item.isTask ? 'standard:task' : 'standard:event',
            typeLabel: item.isTask ? 'Task' : 'Event'
        };
    }

    get priorityOptions() {
        return [
            { label: 'High', value: 'High' },
            { label: 'Normal', value: 'Normal' },
            { label: 'Low', value: 'Low' }
        ];
    }

    get statusOptions() {
        return [
            { label: 'Not Started', value: 'Not Started' },
            { label: 'In Progress', value: 'In Progress' },
            { label: 'Completed', value: 'Completed' },
            { label: 'Waiting on someone else', value: 'Waiting on someone else' },
            { label: 'Deferred', value: 'Deferred' }
        ];
    }

    get isDraftDateRangeAll() {
        return this.draftFilters.dateRange === 'all';
    }
    get isDraftDateRangeLast7() {
        return this.draftFilters.dateRange === 'last7';
    }
    get isDraftDateRangeNext7() {
        return this.draftFilters.dateRange === 'next7';
    }
    get isDraftDateRangeLast30() {
        return this.draftFilters.dateRange === 'last30';
    }

    get isDraftScopeAll() {
        return this.draftFilters.activityScope === 'all';
    }
    get isDraftScopeMine() {
        return this.draftFilters.activityScope === 'mine';
    }

    get isDraftSortOldest() {
        return this.draftFilters.sortDirection === 'oldest';
    }
    get isDraftSortNewest() {
        return this.draftFilters.sortDirection === 'newest';
    }

    get upcomingSectionIcon() {
        return this.isUpcomingSectionOpen ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get expandAllLabel() {
        return this.areAllExpanded ? 'Collapse All' : 'Expand All';
    }

    get dateRangeLabel() {
        const map = {
            all: 'All time',
            last7: 'Last 7 days',
            next7: 'Next 7 days',
            last30: 'Last 30 days'
        };
        return map[this.filters.dateRange] || 'All time';
    }

    get activityScopeLabel() {
        return this.filters.activityScope === 'mine' ? 'My activities' : 'All activities';
    }

    get activityTypesLabel() {
        if (this.filters.includeTasks && this.filters.includeEvents) {
            return 'All types';
        }
        if (this.filters.includeTasks) {
            return 'Tasks';
        }
        if (this.filters.includeEvents) {
            return 'Events';
        }
        return 'No types';
    }

    get filteredItems() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let items = [...this.allItems];

        if (!this.filters.includeTasks) {
            items = items.filter((item) => !item.isTask);
        }

        if (!this.filters.includeEvents) {
            items = items.filter((item) => !item.isEvent);
        }

        if (this.filters.dateRange === 'next7') {
            const end = new Date(today);
            end.setDate(end.getDate() + 7);
            items = items.filter(
                (item) => item.effectiveDate && item.effectiveDate >= today && item.effectiveDate <= end
            );
        }

        if (this.filters.dateRange === 'last7') {
            const start = new Date(today);
            start.setDate(start.getDate() - 7);
            items = items.filter(
                (item) => item.effectiveDate && item.effectiveDate >= start && item.effectiveDate <= now
            );
        }

        if (this.filters.dateRange === 'last30') {
            const start = new Date(today);
            start.setDate(start.getDate() - 30);
            items = items.filter((item) => item.effectiveDate && item.effectiveDate >= start);
        }

        return items.map((item) => {
            const effective = item.effectiveDate ? new Date(item.effectiveDate) : null;
            const effectiveDay = effective
                ? new Date(effective.getFullYear(), effective.getMonth(), effective.getDate())
                : null;

            let isUpcoming = false;
            let isOverdue = false;
            let isHistory = false;

            if (item.isTask) {
                if (item.isClosed) {
                    isHistory = true;
                } else if (effectiveDay) {
                    if (effectiveDay < today) {
                        isOverdue = true;
                    } else {
                        isUpcoming = true;
                    }
                } else {
                    isUpcoming = true;
                }
            } else if (item.isEvent) {
                if (effective) {
                    if (effective >= now) {
                        isUpcoming = true;
                    } else {
                        isHistory = true;
                    }
                }
            }

            return { ...item, isUpcoming, isOverdue, isHistory };
        });
    }

    get upcomingItems() {
        const items = this.filteredItems.filter((item) => item.isUpcoming || item.isOverdue);

        items.sort((a, b) => {
            const aTime = a.effectiveDate ? new Date(a.effectiveDate).getTime() : 0;
            const bTime = b.effectiveDate ? new Date(b.effectiveDate).getTime() : 0;
            return aTime - bTime;
        });

        return items;
    }

    get hasUpcomingItems() {
        return this.upcomingItems.length > 0;
    }

    get historyGroups() {
        const history = this.filteredItems.filter((item) => item.isHistory);

        const grouped = {};
        history.forEach((item) => {
            const key = item.monthLabel || 'No Date';
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(item);
        });

        const groups = Object.keys(grouped).map((key) => ({
            key,
            label: key,
            items: grouped[key].sort((a, b) => {
                const aTime = a.effectiveDate ? new Date(a.effectiveDate).getTime() : 0;
                const bTime = b.effectiveDate ? new Date(b.effectiveDate).getTime() : 0;
                return bTime - aTime;
            })
        }));

        groups.sort((a, b) => {
            const aTime = a.items[0]?.effectiveDate ? new Date(a.items[0].effectiveDate).getTime() : 0;
            const bTime = b.items[0]?.effectiveDate ? new Date(b.items[0].effectiveDate).getTime() : 0;
            return bTime - aTime;
        });

        return this.showAllHistory ? groups : groups.slice(0, 1);
    }

    get showAllButton() {
        const history = this.filteredItems.filter((item) => item.isHistory);
        const distinctMonths = new Set(history.map((item) => item.monthLabel || 'No Date'));
        return distinctMonths.size > 1 && !this.showAllHistory;
    }

    handleDraftDateRangeManual(event) {
        this.draftFilters = { ...this.draftFilters, dateRange: event.target.value };
    }

    handleDraftScopeManual(event) {
        this.draftFilters = { ...this.draftFilters, activityScope: event.target.value };
    }

    handleDraftSortManual(event) {
        this.draftFilters = { ...this.draftFilters, sortDirection: event.target.value };
    }

    handleDraftAllTypesChange(event) {
        const checked = event.target.checked;
        this.draftFilters = {
            ...this.draftFilters,
            includeAllTypes: checked,
            includeTasks: checked,
            includeEvents: checked,
            includeLoggedCalls: checked,
            includeEmail: checked,
            includeWeb: checked,
            includeListEmail: checked
        };
    }

    handleDraftLoggedCallsChange(event) {
        this.draftFilters = { ...this.draftFilters, includeLoggedCalls: event.target.checked };
    }

    handleDraftEmailChange(event) {
        this.draftFilters = { ...this.draftFilters, includeEmail: event.target.checked };
    }

    handleDraftWebChange(event) {
        this.draftFilters = { ...this.draftFilters, includeWeb: event.target.checked };
    }

    handleDraftListEmailChange(event) {
        this.draftFilters = { ...this.draftFilters, includeListEmail: event.target.checked };
    }

    handleDraftTasksChange(event) {
        this.draftFilters = { ...this.draftFilters, includeTasks: event.target.checked };
    }

    handleDraftEventsChange(event) {
        this.draftFilters = { ...this.draftFilters, includeEvents: event.target.checked };
    }

    toggleUpcomingSection() {
        this.isUpcomingSectionOpen = !this.isUpcomingSectionOpen;
    }

    openFilters() {
        this.draftFilters = { ...this.filters };
        this.isFilterPanelOpen = true;
    }

    closeFilters() {
        this.isFilterPanelOpen = false;
    }

    restoreDefaults() {
        this.draftFilters = {
            dateRange: 'all',
            activityScope: 'all',
            includeTasks: true,
            includeEvents: true,
            includeAllTypes: true,
            includeLoggedCalls: true,
            includeEmail: true,
            includeWeb: true,
            includeListEmail: true,
            sortDirection: 'newest'
        };
    }

    applyFilters() {
        this.filters = { ...this.draftFilters };
        this.isFilterPanelOpen = false;
    }

    async handleRefresh() {
        this.isLoading = true;
        try {
            await refreshApex(this.wiredActivitiesResult);
        } finally {
            this.isLoading = false;
        }
    }

    handleToggleExpandAll() {
        this.areAllExpanded = !this.areAllExpanded;
    }

    handleShowAllActivities() {
        this.showAllHistory = true;
    }

    // openNewTaskModal() {
    //     this.newTask = {
    //         subject: this.subjectOptions.length > 0 ? this.subjectOptions[0].value : '',
    //         activityDate: null,
    //         status: 'Not Started',
    //         priority: 'Normal',
    //         description: '',
    //         ownerId: this.ownerOptions.length > 0 ? this.ownerOptions[0].value : ''
    //     };
    //     this.isNewTaskModalOpen = true;
    // }

    // closeNewTaskModal() {
    //     this.isNewTaskModalOpen = false;
    // }

    // handleSubjectChange(event) {
    //     this.newTask = { ...this.newTask, subject: event.detail.value };
    // }

    // handleDueDateChange(event) {
    //     this.newTask = { ...this.newTask, activityDate: event.target.value };
    // }

    // handlePriorityChange(event) {
    //     this.newTask = { ...this.newTask, priority: event.detail.value };
    // }

    // handleStatusChange(event) {
    //     this.newTask = { ...this.newTask, status: event.detail.value };
    // }

    // handleOwnerChange(event) {
    //     this.newTask = { ...this.newTask, ownerId: event.detail.value };
    // }

    // handleDescriptionChange(event) {
    //     this.newTask = { ...this.newTask, description: event.target.value };
    // }

    // async saveNewTask() {
    //     if (!this.newTask.subject || !this.newTask.subject.trim()) {
    //         this.dispatchEvent(
    //             new ShowToastEvent({
    //                 title: 'Error',
    //                 message: 'Subject is required.',
    //                 variant: 'error'
    //             })
    //         );
    //         return;
    //     }

    //     if (!this.newTask.ownerId) {
    //         this.dispatchEvent(
    //             new ShowToastEvent({
    //                 title: 'Error',
    //                 message: 'Assigned To is required.',
    //                 variant: 'error'
    //             })
    //         );
    //         return;
    //     }

    //     try {
    //         const result = await createTask({
    //             requestData: {
    //                 whatId: this.recordId,
    //                 subject: this.newTask.subject,
    //                 activityDate: this.newTask.activityDate,
    //                 status: this.newTask.status,
    //                 priority: this.newTask.priority,
    //                 description: this.newTask.description,
    //                 ownerId: this.newTask.ownerId
    //             }
    //         });

    //         console.log('createTask result', JSON.stringify(result));

    //         if (!result?.success) {
    //             this.dispatchEvent(
    //                 new ShowToastEvent({
    //                     title: 'Error',
    //                     message: result?.message || 'Error creating task.',
    //                     variant: 'error'
    //                 })
    //             );
    //             return;
    //         }

    //         this.isNewTaskModalOpen = false;

    //         this.dispatchEvent(
    //             new ShowToastEvent({
    //                 title: 'Success',
    //                 message: result.message || 'Task created successfully.',
    //                 variant: 'success'
    //             })
    //         );

    //         await this.handleRefresh();
    //     } catch (error) {
    //         console.error('createTask transport error', JSON.stringify(error));

    //         this.dispatchEvent(
    //             new ShowToastEvent({
    //                 title: 'Error',
    //                 message:
    //                     error?.body?.message ||
    //                     error?.message ||
    //                     'Error creating task.',
    //                 variant: 'error'
    //             })
    //         );
    //     }
    // }
}

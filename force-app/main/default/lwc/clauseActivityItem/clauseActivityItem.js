import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import updateTaskStatus from '@salesforce/apex/ClauseActivityController.updateTaskStatus';
import updateTaskPriority from '@salesforce/apex/ClauseActivityController.updateTaskPriority';
import deleteActivity from '@salesforce/apex/ClauseActivityController.deleteActivity';

export default class ClauseActivityItem extends NavigationMixin(LightningElement) {
    @api item;
    @track isExpanded = false;
    @track isStatusModalOpen = false;
    @track selectedStatus;

    _expandedAll = false;

    @api
    get expandedAll() {
        return this._expandedAll;
    }
    set expandedAll(value) {
        this._expandedAll = value;
        this.isExpanded = value;
    }

    // get showCheckbox() {
    //     return this.item?.isTask;
    // }

    // get isCompleted() {
    //     return this.item?.status === 'Completed' || this.item?.isClosed;
    // }

    get expandIcon() {
        return this.isExpanded ? 'utility:chevrondown' : 'utility:chevronright';
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

    get dateText() {
        if (!this.item) return '';

        if (this.item?.isTask && !this.item?.effectiveDate) {
            return 'No due date';
        }

        if (this.item?.effectiveDate) {
            const d = new Date(this.item.effectiveDate);
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);
            const tomorrow = new Date();
            tomorrow.setDate(today.getDate() + 1);

            const isSameDate = (a, b) =>
                a.getFullYear() === b.getFullYear() &&
                a.getMonth() === b.getMonth() &&
                a.getDate() === b.getDate();

            if (isSameDate(d, today)) return 'Today';
            if (isSameDate(d, yesterday)) return 'Yesterday';
            if (isSameDate(d, tomorrow)) return 'Tomorrow';

            return d.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }

        return '';
    }

    get taskMeta() {
        const parts = [];
        if (this.item.status) parts.push(`Status: ${this.item.status}`);
        if (this.item.priority) parts.push(`Priority: ${this.item.priority}`);
        if (this.item.ownerName) parts.push(`Assigned To: ${this.item.ownerName}`);
        return parts.join(' • ');
    }

    get eventMeta() {
        const parts = [];
        if (this.item.location) parts.push(`Location: ${this.item.location}`);
        if (this.item.ownerName) parts.push(`Owner: ${this.item.ownerName}`);
        return parts.join(' • ');
    }

    toggleExpanded() {
        this.isExpanded = !this.isExpanded;
    }

    openRecord() {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.item.id,
                objectApiName: this.item.objectApiName,
                actionName: 'view'
            }
        });
    }

    // async handleCheckboxChange(event) {
    //     if (!this.item?.isTask) return;

    //     const checked = event.target.checked;
    //     const nextStatus = checked ? 'Completed' : 'Not Started';

    //     try {
    //         await updateTaskStatus({
    //             taskId: this.item.id,
    //             statusValue: nextStatus
    //         });

    //         this.toast('Success', `Task marked ${nextStatus}.`, 'success');
    //         this.dispatchEvent(new CustomEvent('refresh'));
    //     } catch (error) {
    //         event.target.checked = this.isCompleted;
    //         this.toast('Error', this.reduceError(error), 'error');
    //     }
    // }

    handleMenuSelect(event) {
        const action = event.detail.value;

        if (action === 'edit') {
            this.navigateEdit();
            return;
        }

        if (action === 'delete') {
            this.handleDelete();
            return;
        }

        if (action === 'changeStatus') {
            this.openStatusModal();
            return;
        }

        if (action === 'changeDate') {
            this.navigateEdit();
            return;
        }

        if (action === 'changePriority') {
            this.quickUpdateTaskPriority();
            return;
        }

        if (action === 'followupTask') {
            this.createFollowupTask();
            return;
        }

        if (action === 'followupEvent') {
            this.createFollowupEvent();
        }
    }

    openStatusModal() {
        if (!this.item?.isTask) return;
        this.selectedStatus = this.item.status || 'Not Started';
        this.isStatusModalOpen = true;
    }

    closeStatusModal() {
        this.isStatusModalOpen = false;
    }

    handleStatusValueChange(event) {
        this.selectedStatus = event.detail.value;
    }

    async saveStatusChange() {
        if (!this.item?.isTask) return;

        try {
            await updateTaskStatus({
                taskId: this.item.id,
                statusValue: this.selectedStatus
            });

            this.isStatusModalOpen = false;
            this.toast('Success', 'Task status updated.', 'success');
            this.dispatchEvent(new CustomEvent('refresh'));
        } catch (error) {
            this.toast('Error', this.reduceError(error), 'error');
        }
    }

    navigateEdit() {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.item.id,
                objectApiName: this.item.objectApiName,
                actionName: 'edit'
            }
        });
    }

    async handleDelete() {
        try {
            await deleteActivity({
                activityId: this.item.id,
                objectApiName: this.item.objectApiName
            });

            this.toast('Success', 'Activity deleted successfully.', 'success');
            this.dispatchEvent(new CustomEvent('refresh'));
        } catch (error) {
            this.toast('Error', this.reduceError(error), 'error');
        }
    }

    async quickUpdateTaskStatus() {
        if (!this.item?.isTask) return;

        const nextStatus = this.item.status === 'Completed' ? 'Not Started' : 'Completed';

        try {
            await updateTaskStatus({
                taskId: this.item.id,
                statusValue: nextStatus
            });

            this.toast('Success', 'Task status updated.', 'success');
            this.dispatchEvent(new CustomEvent('refresh'));
        } catch (error) {
            this.toast('Error', this.reduceError(error), 'error');
        }
    }

    async quickUpdateTaskPriority() {
        if (!this.item?.isTask) return;

        const nextPriority =
            this.item.priority === 'High'
                ? 'Normal'
                : this.item.priority === 'Normal'
                    ? 'Low'
                    : 'High';

        try {
            await updateTaskPriority({
                taskId: this.item.id,
                priorityValue: nextPriority
            });

            this.toast('Success', 'Task priority updated.', 'success');
            this.dispatchEvent(new CustomEvent('refresh'));
        } catch (error) {
            this.toast('Error', this.reduceError(error), 'error');
        }
    }

    createFollowupTask() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Task',
                actionName: 'new'
            },
            state: {
                defaultFieldValues: `WhatId=${this.item.id},Subject=Follow Up: ${encodeURIComponent(this.item.subject || '')}`
            }
        });
    }

    createFollowupEvent() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Event',
                actionName: 'new'
            },
            state: {
                defaultFieldValues: `WhatId=${this.item.id},Subject=Follow Up: ${encodeURIComponent(this.item.subject || '')}`
            }
        });
    }

    toast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }

    reduceError(error) {
        if (Array.isArray(error?.body)) {
            return error.body.map((e) => e.message).join(', ');
        }
        return error?.body?.message || error?.message || 'Unknown error';
    }
}
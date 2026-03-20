import { LightningElement, api, track, wire } from 'lwc';
import { MessageContext, subscribe, unsubscribe } from 'lightning/messageService';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import CLAUSE_SELECTED_CHANNEL from '@salesforce/messageChannel/ClauseSelected__c';

export default class ClauseReviewPanel extends LightningElement {
    @api recordId;
    @track selectedClauseId;
    @track activeAction = null;
    @track isEditMode = false;
    @track activeTab = 'details';

    @wire(MessageContext) messageContext;
    _subscription = null;

    connectedCallback() {
        if (!this._subscription) {
            this._subscription = subscribe(
                this.messageContext,
                CLAUSE_SELECTED_CHANNEL,
                (msg) => {
                    this.selectedClauseId = msg.clauseId;
                    this.isEditMode = false;
                    this.activeTab = 'details';
                }
            );
        }
    }

    disconnectedCallback() {
        if (this._subscription) {
            unsubscribe(this._subscription);
            this._subscription = null;
        }
    }

    handleClauseSelect = (event) => {
        this.selectedClauseId = event.detail.clauseId;
        this.isEditMode = false;
        // this.activeTab = 'details';
    };

    handleReject = () => {
        this.activeAction = 'Reject';
    };

    handleApprove = () => {
        this.activeAction = 'Approve';
    };

    closeModal = () => {
        this.activeAction = null;
    };

    get detailsTabClass() {
        return this.activeTab === 'details'
            ? 'crp__tab-btn crp__tab-btn--active'
            : 'crp__tab-btn';
    }
    get activityTabClass() {
        return this.activeTab === 'activity'
            ? 'crp__tab-btn crp__tab-btn--active'
            : 'crp__tab-btn';
    }
    get chatterTabClass() {
        return this.activeTab === 'chatter'
            ? 'crp__tab-btn crp__tab-btn--active'
            : 'crp__tab-btn';
    }

    get isDetailsTab() { return this.activeTab === 'details'; }
    get isActivityTab() { return this.activeTab === 'activity'; }
    get isChatterTab() { return this.activeTab === 'chatter'; }

    handleTabClick(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }

    handleTaskCreated = (event) => {
        this.activeAction = null;

        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: `Clause ${event.detail.action}d — Compliance Task created.`,
                variant: 'success'
            })
        );

        const id = this.selectedClauseId;
        this.selectedClauseId = undefined;

        setTimeout(() => {
            this.selectedClauseId = id;
            this.isEditMode = false;
        }, 0);
    };

    enterEditMode = () => {
        if (!this.selectedClauseId) {
            return;
        }
        this.isEditMode = true;
        this.activeTab = 'details';
    };

    handleCancelEdit = () => {
        this.isEditMode = false;
    };

    handleSubmit = () => {
        // reserved if you want spinner later
    };

    handleSaveSuccess = () => {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Clause updated successfully.',
                variant: 'success'
            })
        );

        this.isEditMode = false;

        const id = this.selectedClauseId;
        this.selectedClauseId = undefined;

        setTimeout(() => {
            this.selectedClauseId = id;
        }, 0);
    };

    handleSaveError = (event) => {
        let message = 'Error updating clause.';
        if (event?.detail?.message) {
            message = event.detail.message;
        }

        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Error',
                message,
                variant: 'error'
            })
        );
    };
}
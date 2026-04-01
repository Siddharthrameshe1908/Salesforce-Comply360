import { LightningElement, api, track, wire } from 'lwc';
import { MessageContext, subscribe, unsubscribe } from 'lightning/messageService';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getRecord } from 'lightning/uiRecordApi';
import { refreshApex } from '@salesforce/apex';
import createClauseVersion from '@salesforce/apex/ClauseVersioningController.createClauseVersion';
import CLAUSE_SELECTED_CHANNEL from '@salesforce/messageChannel/ClauseSelected__c';

const CLAUSE_UI_FIELDS = [
    'devcomply360__Clause__c.Name',
    'devcomply360__Clause__c.devcomply360__Source_Compliance__c',
    'devcomply360__Clause__c.devcomply360__Clause_Lifecycle_Status__c',
    'devcomply360__Clause__c.devcomply360__Parent_Clause__c',
    'devcomply360__Clause__c.devcomply360__Clause_Owner__c',
    'devcomply360__Clause__c.devcomply360__Section__c',
    'devcomply360__Clause__c.devcomply360__Clause_Type__c',
    'devcomply360__Clause__c.devcomply360__Page_Number__c',
    'devcomply360__Clause__c.devcomply360__Category__c',
    'devcomply360__Clause__c.devcomply360__Description__c',
    'devcomply360__Clause__c.devcomply360__Obligation_Category__c',
    'devcomply360__Clause__c.devcomply360__Version__c',
    'devcomply360__Clause__c.devcomply360__Risk_Level__c',
    'devcomply360__Clause__c.devcomply360__Review_Date__c',
    'devcomply360__Clause__c.devcomply360__Reviewer__c',
    'devcomply360__Clause__c.devcomply360__Review_Notes__c',
    'devcomply360__Clause__c.devcomply360__Due_Date__c',
    'devcomply360__Clause__c.devcomply360__Review_Frequency__c',
    'devcomply360__Clause__c.devcomply360__Assigned_To__c',
    'devcomply360__Clause__c.devcomply360__Clause_Text__c'
];
const IMMUTABLE_LIFECYCLE_STATUSES = ['Enforced'];

export default class ClauseReviewPanel extends LightningElement {
    @api recordId;
    @track selectedClauseId;
    @track selectedClauseName;
    @track activeAction = null;
    @track isEditMode = false;
    @track activeTab = 'details';
    @track viewMode = 'list';
    @track showVersionModal = false;
    @track isSaving = false;
    @track originalClauseData = {};
    @track pendingEditedValues = {};

    @wire(MessageContext) messageContext;
    _subscription = null;
    clauseWireResult;

    @wire(getRecord, { recordId: '$selectedClauseId', fields: CLAUSE_UI_FIELDS })
    wiredClauseRecord(value) {
        this.clauseWireResult = value;
        const { data } = value;
        if (!data) {
            return;
        }

        const snapshot = {};
        Object.keys(data.fields).forEach((fieldApiName) => {
            snapshot[fieldApiName] = data.fields[fieldApiName].value;
        });
        this.originalClauseData = snapshot;
        if (!this.selectedClauseName && snapshot.Name) {
            this.selectedClauseName = snapshot.Name;
        }
    }

    connectedCallback() {
        this.viewMode = 'list';
        this.selectedClauseId = undefined;
        this.selectedClauseName = undefined;

        if (!this._subscription) {
            this._subscription = subscribe(
                this.messageContext,
                CLAUSE_SELECTED_CHANNEL,
                (msg) => {
                    this.selectedClauseId = msg.clauseId;
                    this.selectedClauseName = msg.clauseName || undefined;
                    this.isEditMode = false;
                    this.showVersionModal = false;
                    this.pendingEditedValues = {};
                    this.activeTab = 'details';
                    this.viewMode = msg.clauseId ? 'detail' : 'list';
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
        this.selectedClauseName = event.detail.clauseName || undefined;
        this.isEditMode = false;
        this.showVersionModal = false;
        this.pendingEditedValues = {};
        this.activeTab = 'details';
        this.viewMode = 'detail';
    };

    handleBreadcrumbClick = (event) => {
        event.preventDefault();
        if (event.currentTarget?.name !== 'clauses') {
            return;
        }

        this.viewMode = 'list';
        this.isEditMode = false;
        this.showVersionModal = false;
        this.pendingEditedValues = {};
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

    get isDetailsTab() {
        return this.activeTab === 'details';
    }

    get isActivityTab() {
        return this.activeTab === 'activity';
    }

    get isChatterTab() {
        return this.activeTab === 'chatter';
    }

    get isDetailMode() {
        return this.viewMode === 'detail';
    }

    get showLeftPanel() {
        return !this.isDetailMode;
    }

    get listPanelClass() {
        return this.isDetailMode ? 'crp__left' : 'crp__left crp__left--full';
    }

    get detailPanelClass() {
        return this.isDetailMode ? 'crp__detail crp__detail--expanded' : 'crp__detail';
    }

    get rightPanelClass() {
        return this.isDetailMode ? 'crp__right crp__right--expanded' : 'crp__right';
    }

    get breadcrumbClauseLabel() {
        return this.selectedClauseName || this.originalClauseData?.Name || 'Selected Clause';
    }

    handleTabClick(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }

    handleTaskCreated = (event) => {
        this.activeAction = null;

        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: `Clause ${event.detail.action}d - Compliance Task created.`,
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
        this.showVersionModal = false;
        this.pendingEditedValues = {};
        this.isEditMode = true;
        this.activeTab = 'details';
    };

    handleCancelEdit = () => {
        this.showVersionModal = false;
        this.pendingEditedValues = {};
        this.isEditMode = false;
    };

    handleSubmit = (event) => {
        event.preventDefault();

        if (this.isSaving) {
            return;
        }

        const lifecycleStatus = this.originalClauseData?.devcomply360__Clause_Lifecycle_Status__c;
        if (IMMUTABLE_LIFECYCLE_STATUSES.includes(lifecycleStatus)) {
            this.showToast(
                'Error',
                `You cannot edit this clause because lifecycle status is ${lifecycleStatus}.`,
                'error'
            );
            return;
        }

        const inputFields = [...this.template.querySelectorAll('lightning-input-field')];
        const allValid = inputFields.reduce((isValid, field) => {
            return field.reportValidity() && isValid;
        }, true);

        if (!allValid) {
            this.showToast('Error', 'Please resolve validation errors before saving.', 'error');
            return;
        }

        this.pendingEditedValues = { ...event.detail.fields };
        this.showVersionModal = true;
    };

    handleDeclineVersioning = () => {
        if (this.isSaving) {
            return;
        }
        this.showVersionModal = false;
    };

    handleConfirmVersioning = async () => {
        if (this.isSaving) {
            return;
        }

        if (!this.selectedClauseId) {
            this.showToast('Error', 'No clause selected for versioning.', 'error');
            return;
        }

        this.isSaving = true;
        try {
            const newClauseId = await createClauseVersion({
                recordId: this.selectedClauseId,
                editedValues: this.pendingEditedValues
            });

            this.showVersionModal = false;
            this.pendingEditedValues = {};
            this.isEditMode = false;
            this.selectedClauseId = newClauseId;
            this.selectedClauseName = undefined;

            if (this.clauseWireResult) {
                await refreshApex(this.clauseWireResult);
            }
            this.showToast('Success', 'New clause version created successfully.', 'success');
        } catch (error) {
            this.showToast('Error', this.extractErrorMessage(error), 'error');
        } finally {
            this.isSaving = false;
        }
    };

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }

    extractErrorMessage(error) {
        if (Array.isArray(error?.body)) {
            return error.body.map((entry) => entry.message).join(', ');
        }

        if (typeof error?.body?.message === 'string' && error.body.message) {
            return error.body.message;
        }

        if (typeof error?.message === 'string' && error.message) {
            return error.message;
        }

        return 'An unexpected error occurred while creating a new clause version.';
    }
}



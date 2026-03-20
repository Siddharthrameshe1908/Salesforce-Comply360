import { LightningElement, api, track } from 'lwc';
import createTaskAndUpdateClause from '@salesforce/apex/ClauseActionController.createTaskAndUpdateClause';

const VARIANT = { Reject: 'destructive', Approve: 'brand' };
const LABEL   = { Reject: 'Reject', Approve: 'Approve' };

const PRIORITY_OPTIONS = [
    { label: 'High',   value: 'High' },
    { label: 'Normal', value: 'Normal' },
    { label: 'Low',    value: 'Low' }
];

export default class ClauseActionModal extends LightningElement {
    @api clauseId;
    @api action;

    @track notes    = '';
    @track dueDate  = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    @track priority = 'Normal';
    @track isSaving = false;
    @track error;

    priorityOptions = PRIORITY_OPTIONS;

    get title()          { return `${this.action} Clause`; }
    get confirmLabel()   { return LABEL[this.action] || this.action; }
    get confirmVariant() { return VARIANT[this.action] || 'brand'; }
    get isApprove()      { return this.action === 'Approve'; }

    handleNotes    = (e) => { this.notes    = e.target.value; };
    handleDueDate  = (e) => { this.dueDate  = e.target.value; };
    handlePriority = (e) => { this.priority = e.target.value; };
    handleCancel   = ()  => { this.dispatchEvent(new CustomEvent('close')); };

    handleConfirm = async () => {
        this.isSaving = true;
        this.error    = null;
        try {
            const taskId = await createTaskAndUpdateClause({
                clauseId : this.clauseId,
                action   : this.action,
                notes    : this.notes,
                dueDate  : this.dueDate,
                priority : this.priority
            });
            this.dispatchEvent(new CustomEvent('taskcreated', { detail: { taskId, action: this.action } }));
        } catch (e) {
            this.error = e.body?.message || 'An error occurred.';
        } finally {
            this.isSaving = false;
        }
    };
}
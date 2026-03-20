import { LightningElement, api } from "lwc";

export default class ComplianceWorkspace extends LightningElement {
    @api recordId; 

    selectedClauseId;

    handleClauseSelect(event) {
        this.selectedClauseId = event.detail.clauseId;
    }
}
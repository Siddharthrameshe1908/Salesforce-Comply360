import { LightningElement, api, wire } from 'lwc';
import getComplianceSummary from '@salesforce/apex/ComplianceSummaryController.getComplianceSummary';

export default class ComplianceSummaryDashboard extends LightningElement {
    @api recordId;

    summary;
    errorMessage;
    isLoaded = false;

    @wire(getComplianceSummary, { complianceId: '$recordId' })
    wiredSummary({ data, error }) {
        if (data) {
            this.summary = data;
            this.errorMessage = undefined;
            this.isLoaded = true;
        } else if (error) {
            this.summary = undefined;
            this.errorMessage = 'Unable to load compliance summary.';
            this.isLoaded = true;
            // eslint-disable-next-line no-console
            console.error(JSON.stringify(error));
        }
    }
}
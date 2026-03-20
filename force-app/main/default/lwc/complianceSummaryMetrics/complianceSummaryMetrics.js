import { LightningElement, api } from 'lwc';

export default class ComplianceSummaryMetrics extends LightningElement {
    @api totalClauses;
    @api enforcedClauses;
    @api inReviewClauses;
    @api overdueTasks;
}
import { LightningElement, api, wire } from "lwc";
import { getRecord } from "lightning/uiRecordApi";
import USER_NAME from "@salesforce/schema/User.Name";

const FIELDS = [
    "devcomply360__Clause__c.Name",
    "devcomply360__Clause__c.devcomply360__Clause_ID__c",
    "devcomply360__Clause__c.devcomply360__Version__c",
    "devcomply360__Clause__c.devcomply360__Category__c",
    "devcomply360__Clause__c.devcomply360__Assigned_To__c",
    "devcomply360__Clause__c.devcomply360__Clause_Owner__c",
    "devcomply360__Clause__c.devcomply360__Source_Compliance__c",
    "devcomply360__Clause__c.devcomply360__Clause_Text__c",
    "devcomply360__Clause__c.devcomply360__Clause_Type__c",
    "devcomply360__Clause__c.devcomply360__Comments__c",
    "devcomply360__Clause__c.devcomply360__Description__c",
    "devcomply360__Clause__c.devcomply360__Due_Date__c",
    "devcomply360__Clause__c.devcomply360__Last_Modified__c",
    "devcomply360__Clause__c.devcomply360__Obligation_Category__c",
    "devcomply360__Clause__c.devcomply360__Page_Number__c",
    "devcomply360__Clause__c.devcomply360__Review_Date__c",
    "devcomply360__Clause__c.devcomply360__Review_Frequency__c",
    "devcomply360__Clause__c.devcomply360__Review_Notes__c",
    "devcomply360__Clause__c.devcomply360__Review_Status__c",
    "devcomply360__Clause__c.devcomply360__Reviewer__c",
    "devcomply360__Clause__c.devcomply360__Risk_Level__c",
    "devcomply360__Clause__c.devcomply360__Section__c",
    "devcomply360__Clause__c.CreatedById",
    "devcomply360__Clause__c.CreatedDate",
    "devcomply360__Clause__c.LastModifiedById",
    "devcomply360__Clause__c.LastModifiedDate"
];

export default class ClauseDetailsPanel extends LightningElement {
    @api clauseId;

    @wire(getRecord, { recordId: "$clauseId", fields: FIELDS })
    clauseRecord;

    get hasClause() {
        return !!this.clauseId && !!this.clauseRecord?.data;
    }

    // display helper (good for lookups/picklists/text)
    display(fieldApi) {
        const f = this.clauseRecord?.data?.fields?.[fieldApi];
        return f ? (f.displayValue ?? f.value ?? "") : "";
    }

    // raw helper (required for date/datetime formatted components)
    raw(fieldApi) {
        const f = this.clauseRecord?.data?.fields?.[fieldApi];
        return f ? (f.value ?? null) : null;
    }

    get clauseName() { return this.display("Name"); }
    get clauseAutoNumber() { return this.display("devcomply360__Clause_ID__c"); }
    get version() { return this.display("devcomply360__Version__c"); }
    get category() { return this.display("devcomply360__Category__c"); }

    get assignedTo() { return this.assignedUser?.data?.fields?.Name?.value || ""; }
    get clauseOwner() { return this.ownerUser?.data?.fields?.Name?.value || ""; }

    get reviewer() { return this.display("devcomply360__Reviewer__c"); }
    get reviewStatus() { return this.display("devcomply360__Review_Status__c"); }
    get riskLevel() { return this.display("devcomply360__Risk_Level__c"); }

    get assignedToId() {
        return this.clauseRecord?.data?.fields?.devcomply360__Assigned_To__c?.value || null;
    }

    get clauseOwnerId() {
        return this.clauseRecord?.data?.fields?.devcomply360__Clause_Owner__c?.value || null;
    }

    @wire(getRecord, { recordId: "$assignedToId", fields: [USER_NAME] })
    assignedUser;

    @wire(getRecord, { recordId: "$clauseOwnerId", fields: [USER_NAME] })
    ownerUser;

    // ✅ FIX: use RAW date value
    get dueDate() { return this.raw("devcomply360__Due_Date__c"); }
    get reviewDate() { return this.raw("devcomply360__Review_Date__c"); }

    get reviewFrequency() { return this.display("devcomply360__Review_Frequency__c"); }
    get reviewNotes() { return this.display("devcomply360__Review_Notes__c"); }

    get pageNumber() { return this.display("devcomply360__Page_Number__c"); }
    get clauseType() { return this.display("devcomply360__Clause_Type__c"); }
    get obligationCategory() { return this.display("devcomply360__Obligation_Category__c"); }
    get section() { return this.display("devcomply360__Section__c"); }

    get description() { return this.display("devcomply360__Description__c"); }
    get comments() { return this.display("devcomply360__Comments__c"); }
    get clauseText() { return this.display("devcomply360__Clause_Text__c"); }

    get createdDate() { return this.raw("CreatedDate"); }
    get lastModifiedDate() { return this.raw("LastModifiedDate"); }
}
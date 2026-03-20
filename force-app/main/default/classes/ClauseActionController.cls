public with sharing class ClauseActionController {

    @AuraEnabled
    public static Id createTaskAndUpdateClause(
        Id clauseId,
        String action,
        String notes,
        Date dueDate
    ) {
        // Update clause review status
        String newStatus = action == 'Approve' ? 'Approved'
                         : action == 'Reject'  ? 'Rejected'
                         : 'Under Review';

        devcomply360__Clause__c clause = new devcomply360__Clause__c(
            Id = clauseId,
            devcomply360__Review_Status__c = newStatus,
            devcomply360__Review_Notes__c  = notes
        );
        update clause;

        // Create compliance task
        devcomply360__Compliance_Task__c task = new devcomply360__Compliance_Task__c(
            Name                          = action + ': ' + clauseId,
            devcomply360__Status__c       = 'Assigned',
            devcomply360__Start_Date__c   = Date.today(),
            devcomply360__Due_Date__c     = dueDate != null ? dueDate : Date.today().addDays(7)
        );
        insert task;
        return task.Id;
    }
}

public with sharing class ComplianceSummaryController {

    public class ClauseStatusItem {
        @AuraEnabled public String status;
        @AuraEnabled public Integer count;
        @AuraEnabled public Decimal percentage;
    }

    public class TaskRow {
        @AuraEnabled public Id taskId;
        @AuraEnabled public String taskName;
        @AuraEnabled public String taskRecordUrl;
        @AuraEnabled public String clauseName;
        @AuraEnabled public String clauseRecordUrl;
        @AuraEnabled public String clauseAutoNumber;
        @AuraEnabled public String ownerName;
        @AuraEnabled public Date dueDate;
        @AuraEnabled public Integer daysOverdue;
        @AuraEnabled public String daysOverdueLabel;
        @AuraEnabled public String priority;
        @AuraEnabled public String status;
    }

    public class SummaryResponse {
        @AuraEnabled public String healthLabel;
        @AuraEnabled public String healthTheme;
        @AuraEnabled public Integer totalClauses;
        @AuraEnabled public Integer enforcedClauses;
        @AuraEnabled public Integer inReviewClauses;
        @AuraEnabled public Integer overdueTasks;
        @AuraEnabled public Integer upcomingTasks;
        @AuraEnabled public List<ClauseStatusItem> clauseStatusItems;
        @AuraEnabled public List<TaskRow> overdueRows;
        @AuraEnabled public List<TaskRow> upcomingRows;
    }

    public class TaskPageResponse {
        @AuraEnabled public List<TaskRow> rows;
        @AuraEnabled public Boolean hasMore;
    }

    @AuraEnabled(cacheable=true)
    public static SummaryResponse getComplianceSummary(Id complianceId) {
        if (complianceId == null) {
            throw new AuraHandledException('Compliance Id is required.');
        }

        SummaryResponse response = new SummaryResponse();
        response.clauseStatusItems = new List<ClauseStatusItem>();
        response.overdueRows = new List<TaskRow>();
        response.upcomingRows = new List<TaskRow>();

        Map<String, Integer> statusCountMap = new Map<String, Integer>{
            'Draft' => 0,
            'Approved' => 0,
            'Suspended' => 0,
            'In Review' => 0,
            'Enforced' => 0,
            'Obsolete' => 0
        };

        Integer totalClauses = 0;
        Integer enforcedClauses = 0;
        Integer inReviewClauses = 0;

        for (AggregateResult ar : [
            SELECT devcomply360__Clause_Lifecycle_Status__c statusValue, COUNT(Id) recordCount
            FROM devcomply360__Clause__c
            WHERE devcomply360__Source_Compliance__c = :complianceId
            GROUP BY devcomply360__Clause_Lifecycle_Status__c
        ]) {
            String status = (String) ar.get('statusValue');
            Integer countValue = (Integer) ar.get('recordCount');

            totalClauses += countValue;

            if (status == 'Enforced') {
                enforcedClauses += countValue;
            }
            if (status == 'In Review') {
                inReviewClauses += countValue;
            }
            if (statusCountMap.containsKey(status)) {
                statusCountMap.put(status, countValue);
            }
        }

        Map<Id, devcomply360__Clause__c> clauseMap = new Map<Id, devcomply360__Clause__c>([
            SELECT Id, Name, devcomply360__Clause_ID__c
            FROM devcomply360__Clause__c
            WHERE devcomply360__Source_Compliance__c = :complianceId
        ]);

        Set<Id> clauseIds = clauseMap.keySet();

        Date todayDate = Date.today();

        Integer overdueTasks = 0;
        Integer upcomingTasks = 0;

        if (!clauseIds.isEmpty()) {
            overdueTasks = [
                SELECT COUNT()
                FROM Task
                WHERE WhatId IN :clauseIds
                  AND ActivityDate != null
                  AND ActivityDate < :todayDate
                  AND IsClosed = false
            ];

            upcomingTasks = [
                SELECT COUNT()
                FROM Task
                WHERE WhatId IN :clauseIds
                  AND ActivityDate != null
                  AND ActivityDate >= :todayDate
                  AND IsClosed = false
            ];

            response.overdueRows = queryTaskRows(clauseMap, true, 0, 6);
            response.upcomingRows = queryTaskRows(clauseMap, false, 0, 6);
        }

        for (String statusName : new List<String>{'Draft', 'Approved', 'Suspended', 'In Review', 'Enforced', 'Obsolete'}) {
            ClauseStatusItem item = new ClauseStatusItem();
            item.status = statusName;
            item.count = statusCountMap.get(statusName);
            item.percentage = totalClauses > 0
                ? ((Decimal) item.count * 100) / totalClauses
                : 0;
            response.clauseStatusItems.add(item);
        }

        response.totalClauses = totalClauses;
        response.enforcedClauses = enforcedClauses;
        response.inReviewClauses = inReviewClauses;
        response.overdueTasks = overdueTasks;
        response.upcomingTasks = upcomingTasks;

        if (overdueTasks > 0) {
            response.healthLabel = 'Attention Required';
            response.healthTheme = 'warning';
        } else if (inReviewClauses > 0) {
            response.healthLabel = 'In Review';
            response.healthTheme = 'info';
        } else {
            response.healthLabel = 'Healthy';
            response.healthTheme = 'success';
        }

        return response;
    }

    @AuraEnabled(cacheable=true)
    public static TaskPageResponse getTaskPage(Id complianceId, String tableType, Integer offsetSize, Integer pageSize) {
        if (complianceId == null) {
            throw new AuraHandledException('Compliance Id is required.');
        }

        Integer safeOffset = offsetSize == null ? 0 : offsetSize;
        Integer safePageSize = pageSize == null ? 6 : pageSize;

        Map<Id, devcomply360__Clause__c> clauseMap = new Map<Id, devcomply360__Clause__c>([
            SELECT Id, Name, devcomply360__Clause_ID__c
            FROM devcomply360__Clause__c
            WHERE devcomply360__Source_Compliance__c = :complianceId
        ]);

        TaskPageResponse response = new TaskPageResponse();
        response.rows = new List<TaskRow>();

        if (clauseMap.isEmpty()) {
            response.hasMore = false;
            return response;
        }

        Boolean isOverdue = tableType == 'overdue';
        List<TaskRow> allRows = queryTaskRows(clauseMap, isOverdue, safeOffset, safePageSize + 1);

        if (allRows.size() > safePageSize) {
            response.hasMore = true;
            allRows.remove(allRows.size() - 1);
        } else {
            response.hasMore = false;
        }

        response.rows = allRows;
        return response;
    }

    private static List<TaskRow> queryTaskRows(
        Map<Id, devcomply360__Clause__c> clauseMap,
        Boolean isOverdue,
        Integer offsetSize,
        Integer limitSize
    ) {
        Set<Id> clauseIds = clauseMap.keySet();
        Date todayDate = Date.today();

        List<Task> taskList;

        if (isOverdue) {
            taskList = [
                SELECT Id,
                       Subject,
                       ActivityDate,
                       Priority,
                       Status,
                       Owner.Name,
                       WhatId
                FROM Task
                WHERE WhatId IN :clauseIds
                  AND ActivityDate != null
                  AND ActivityDate < :todayDate
                  AND IsClosed = false
                ORDER BY ActivityDate ASC, CreatedDate ASC
                LIMIT :limitSize
                OFFSET :offsetSize
            ];
        } else {
            taskList = [
                SELECT Id,
                       Subject,
                       ActivityDate,
                       Priority,
                       Status,
                       Owner.Name,
                       WhatId
                FROM Task
                WHERE WhatId IN :clauseIds
                  AND ActivityDate != null
                  AND ActivityDate >= :todayDate
                  AND IsClosed = false
                ORDER BY ActivityDate ASC, CreatedDate ASC
                LIMIT :limitSize
                OFFSET :offsetSize
            ];
        }

        List<TaskRow> rows = new List<TaskRow>();

        for (Task taskRec : taskList) {
            TaskRow row = new TaskRow();
            row.taskId = taskRec.Id;
            row.taskName = taskRec.Subject;
            row.taskRecordUrl = '/' + taskRec.Id;
            row.ownerName = taskRec.Owner != null ? taskRec.Owner.Name : '';
            row.dueDate = taskRec.ActivityDate;
            row.daysOverdue = isOverdue && taskRec.ActivityDate != null
                ? taskRec.ActivityDate.daysBetween(todayDate)
                : 0;
            row.daysOverdueLabel = isOverdue
                ? formatDurationLabel(row.daysOverdue)
                : '';
            row.priority = taskRec.Priority;
            row.status = taskRec.Status;

            if (clauseMap.containsKey(taskRec.WhatId)) {
                devcomply360__Clause__c relatedClause = clauseMap.get(taskRec.WhatId);
                row.clauseName = relatedClause.Name;
                row.clauseRecordUrl = '/' + relatedClause.Id;
                row.clauseAutoNumber = relatedClause.devcomply360__Clause_ID__c;
            }

            rows.add(row);
        }

        return rows;
    }

    private static String formatDurationLabel(Integer totalDays) {
        if (totalDays == null || totalDays <= 0) {
            return '0 Days';
        }

        Integer years = totalDays / 365;
        Integer remainingAfterYears = Math.mod(totalDays, 365);
        Integer months = remainingAfterYears / 30;
        Integer days = Math.mod(remainingAfterYears, 30);

        List<String> parts = new List<String>();

        if (years > 0) {
            parts.add(years + ' ' + (years == 1 ? 'Year' : 'Years'));
        }
        if (months > 0) {
            parts.add(months + ' ' + (months == 1 ? 'Month' : 'Months'));
        }
        if (days > 0) {
            parts.add(days + ' ' + (days == 1 ? 'Day' : 'Days'));
        }

        if (parts.isEmpty()) {
            return totalDays + ' Days';
        }

        if (parts.size() == 1) {
            return parts[0];
        }

        return String.join(parts, ' ');
    }
}

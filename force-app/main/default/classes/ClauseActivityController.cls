public with sharing class ClauseActivityController {

    public class ActivityItemWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public Id whatId;
        @AuraEnabled public String objectApiName;
        @AuraEnabled public String type;
        @AuraEnabled public String subject;
        @AuraEnabled public String status;
        @AuraEnabled public String priority;
        @AuraEnabled public String location;
        @AuraEnabled public String description;
        @AuraEnabled public String ownerName;
        @AuraEnabled public Datetime activityDateTime;
        @AuraEnabled public Date activityDate;
        @AuraEnabled public Boolean isClosed;
        @AuraEnabled public Boolean isTask;
        @AuraEnabled public Boolean isEvent;
        @AuraEnabled public Boolean isOverdue;
        @AuraEnabled public Boolean isUpcoming;
        @AuraEnabled public Boolean isHistory;
        @AuraEnabled public String taskSubtype;
        @AuraEnabled public Datetime createdDate;
    }

    public class NewTaskRequest {
        @AuraEnabled public Id whatId;
        @AuraEnabled public String subject;
        @AuraEnabled public Date activityDate;
        @AuraEnabled public String status;
        @AuraEnabled public String priority;
        @AuraEnabled public String description;
        @AuraEnabled public Id ownerId;
    }

    public class UserOption {
        @AuraEnabled public Id value;
        @AuraEnabled public String label;

        public UserOption(Id value, String label) {
            this.value = value;
            this.label = label;
        }
    }

    public class TaskSaveResponse {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String message;
        @AuraEnabled public Id recordId;
    }

    @AuraEnabled(cacheable=true)
    public static List<ActivityItemWrapper> getActivities(Id recordId) {
        if (recordId == null) {
            return new List<ActivityItemWrapper>();
        }

        List<ActivityItemWrapper> results = new List<ActivityItemWrapper>();
        Date today = Date.today();
        Datetime nowDt = Datetime.now();

        for (Task t : [
            SELECT Id, Subject, Status, Priority, ActivityDate, Description,
                   Owner.Name, OwnerId, IsClosed, WhatId, TaskSubtype, CreatedDate
            FROM Task
            WHERE WhatId = :recordId
            ORDER BY ActivityDate DESC, CreatedDate DESC
            LIMIT 200
        ]) {
            ActivityItemWrapper w = new ActivityItemWrapper();
            w.id = t.Id;
            w.whatId = t.WhatId;
            w.objectApiName = 'Task';
            w.type = 'Task';
            w.subject = t.Subject;
            w.status = t.Status;
            w.priority = t.Priority;
            w.description = t.Description;
            w.ownerName = t.Owner != null ? t.Owner.Name : null;
            w.activityDate = t.ActivityDate;
            w.isClosed = t.IsClosed;
            w.isTask = true;
            w.isEvent = false;
            w.taskSubtype = t.TaskSubtype;
            w.createdDate = t.CreatedDate;

            Boolean hasDate = t.ActivityDate != null;
            w.isOverdue = !t.IsClosed && hasDate && t.ActivityDate < today;
            w.isUpcoming = !t.IsClosed && (!hasDate || t.ActivityDate >= today);
            w.isHistory = t.IsClosed;

            results.add(w);
        }

        for (Event e : [
            SELECT Id, Subject, StartDateTime, EndDateTime, Location, Description,
                   Owner.Name, IsAllDayEvent, WhatId, ActivityDate, CreatedDate
            FROM Event
            WHERE WhatId = :recordId
            ORDER BY StartDateTime DESC, ActivityDate DESC
            LIMIT 200
        ]) {
            ActivityItemWrapper w = new ActivityItemWrapper();
            w.id = e.Id;
            w.whatId = e.WhatId;
            w.objectApiName = 'Event';
            w.type = 'Event';
            w.subject = e.Subject;
            w.location = e.Location;
            w.description = e.Description;
            w.ownerName = e.Owner != null ? e.Owner.Name : null;
            w.activityDateTime = e.StartDateTime;
            w.activityDate = e.ActivityDate;
            w.isClosed = false;
            w.isTask = false;
            w.isEvent = true;
            w.createdDate = e.CreatedDate;

            Datetime compareDt = e.StartDateTime;
            Boolean hasDt = compareDt != null;

            w.isOverdue = false;
            w.isUpcoming = hasDt && compareDt >= nowDt;
            w.isHistory = !w.isUpcoming;

            results.add(w);
        }

        return results;
    }

    @AuraEnabled(cacheable=true)
    public static List<String> getTaskSubjectOptions() {
        List<String> values = new List<String>();
        for (Schema.PicklistEntry entry : Task.Subject.getDescribe().getPicklistValues()) {
            if (entry.isActive()) {
                values.add(entry.getValue());
            }
        }
        return values;
    }

    @AuraEnabled(cacheable=true)
    public static List<UserOption> getAssignableUsers() {
        List<UserOption> results = new List<UserOption>();
        for (User u : [
            SELECT Id, Name
            FROM User
            WHERE IsActive = true
            ORDER BY Name
            LIMIT 200
        ]) {
            results.add(new UserOption(u.Id, u.Name));
        }
        return results;
    }

    @AuraEnabled
    public static TaskSaveResponse createTask(NewTaskRequest requestData) {
        TaskSaveResponse response = new TaskSaveResponse();
        response.success = false;

        try {
            if (requestData == null) {
                response.message = 'Task data is required.';
                return response;
            }
            if (requestData.whatId == null) {
                response.message = 'Related To is required.';
                return response;
            }
            if (String.isBlank(requestData.subject)) {
                response.message = 'Subject is required.';
                return response;
            }
            if (String.isBlank(requestData.status)) {
                response.message = 'Status is required.';
                return response;
            }
            if (String.isBlank(requestData.priority)) {
                response.message = 'Priority is required.';
                return response;
            }
            if (requestData.ownerId == null) {
                response.message = 'Assigned To is required.';
                return response;
            }

            Set<String> allowedSubjects = new Set<String>();
            for (Schema.PicklistEntry entry : Task.Subject.getDescribe().getPicklistValues()) {
                if (entry.isActive()) {
                    allowedSubjects.add(entry.getValue());
                }
            }

            if (!allowedSubjects.contains(requestData.subject)) {
                response.message = 'Invalid Subject value: ' + requestData.subject;
                return response;
            }

            Task t = new Task();
            t.WhatId = requestData.whatId;
            t.Subject = requestData.subject.trim();
            t.ActivityDate = requestData.activityDate;
            t.Status = requestData.status;
            t.Priority = requestData.priority;
            t.Description = requestData.description;
            t.OwnerId = requestData.ownerId;

            Database.SaveResult sr = Database.insert(t, false);

            if (!sr.isSuccess()) {
                if (sr.getErrors() != null && !sr.getErrors().isEmpty()) {
                    Database.Error err = sr.getErrors()[0];
                    response.message =
                        'Task creation failed: ' +
                        String.valueOf(err.getStatusCode()) +
                        ' - ' +
                        err.getMessage();
                } else {
                    response.message = 'Task creation failed for an unknown reason.';
                }
                return response;
            }

            response.success = true;
            response.recordId = sr.getId();
            response.message = 'Task created successfully.';
            return response;

        } catch (Exception e) {
            response.success = false;
            response.message =
                'Task creation exception: ' +
                e.getTypeName() +
                ' - ' +
                e.getMessage() +
                ' | Line: ' +
                e.getLineNumber();
            return response;
        }
    }

    @AuraEnabled
    public static void updateTaskStatus(Id taskId, String statusValue) {
        if (taskId == null) {
            throw new AuraHandledException('Task Id is required.');
        }
        if (String.isBlank(statusValue)) {
            throw new AuraHandledException('Status is required.');
        }

        Database.SaveResult sr = Database.update(new Task(
            Id = taskId,
            Status = statusValue
        ), false);

        if (!sr.isSuccess()) {
            Database.Error err = sr.getErrors()[0];
            throw new AuraHandledException(
                'Task status update failed: ' + String.valueOf(err.getStatusCode()) + ' - ' + err.getMessage()
            );
        }
    }

    @AuraEnabled
    public static void updateTaskPriority(Id taskId, String priorityValue) {
        if (taskId == null) {
            throw new AuraHandledException('Task Id is required.');
        }
        if (String.isBlank(priorityValue)) {
            throw new AuraHandledException('Priority is required.');
        }

        Database.SaveResult sr = Database.update(new Task(
            Id = taskId,
            Priority = priorityValue
        ), false);

        if (!sr.isSuccess()) {
            Database.Error err = sr.getErrors()[0];
            throw new AuraHandledException(
                'Task priority update failed: ' + String.valueOf(err.getStatusCode()) + ' - ' + err.getMessage()
            );
        }
    }

    @AuraEnabled
    public static void deleteActivity(Id activityId, String objectApiName) {
        if (activityId == null) {
            throw new AuraHandledException('Activity Id is required.');
        }
        if (String.isBlank(objectApiName)) {
            throw new AuraHandledException('Object API Name is required.');
        }

        SObject recordToDelete;
        if (objectApiName == 'Task') {
            recordToDelete = new Task(Id = activityId);
        } else if (objectApiName == 'Event') {
            recordToDelete = new Event(Id = activityId);
        } else {
            throw new AuraHandledException('Unsupported activity type.');
        }

        Database.DeleteResult dr = Database.delete(recordToDelete, false);
        if (!dr.isSuccess()) {
            Database.Error err = dr.getErrors()[0];
            throw new AuraHandledException(
                'Delete failed: ' + String.valueOf(err.getStatusCode()) + ' - ' + err.getMessage()
            );
        }
    }
}

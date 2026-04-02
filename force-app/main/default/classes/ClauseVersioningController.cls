public with sharing class ClauseVersioningController {
    private static final String VERSION_FIELD = 'devcomply360__Version__c';
    private static final String STATUS_FIELD = 'devcomply360__Clause_Lifecycle_Status__c';
    private static final String PARENT_FIELD = 'devcomply360__Parent_Clause__c';
    private static final Set<String> DIRECT_SAVE_STATUSES = new Set<String>{ 'Draft', 'In Review', 'Approved' };
    private static final String ENFORCED_STATUS = 'Enforced';
    private static final String OBSOLETE_STATUS = 'Obsolete';

    private static final Set<String> COPY_FIELDS = new Set<String>{
        'Name',
        'devcomply360__Source_Compliance__c',
        'devcomply360__Clause_Lifecycle_Status__c',
        'devcomply360__Parent_Clause__c',
        'devcomply360__Clause_Owner__c',
        'devcomply360__Section__c',
        'devcomply360__Clause_Type__c',
        'devcomply360__Page_Number__c',
        'devcomply360__Category__c',
        'devcomply360__Description__c',
        'devcomply360__Obligation_Category__c',
        'devcomply360__Version__c',
        'devcomply360__Risk_Level__c',
        'devcomply360__Review_Date__c',
        'devcomply360__Reviewer__c',
        'devcomply360__Review_Notes__c',
        'devcomply360__Due_Date__c',
        'devcomply360__Review_Frequency__c',
        'devcomply360__Assigned_To__c',
        'devcomply360__Clause_Text__c'
    };

    @AuraEnabled
    public static Id createClauseVersion(Id recordId, Map<String, Object> editedValues) {
        if (recordId == null) {
            throw new AuraHandledException('Clause Id is required.');
        }

        Schema.DescribeSObjectResult clauseDescribe = devcomply360__Clause__c.SObjectType.getDescribe();
        if (!clauseDescribe.isAccessible() || !clauseDescribe.isCreateable() || !clauseDescribe.isUpdateable()) {
            throw new AuraHandledException('You do not have access to version this clause.');
        }

        Map<String, Schema.SObjectField> fieldMap = clauseDescribe.fields.getMap();
        List<String> orderedFields = new List<String>(COPY_FIELDS);
        orderedFields.sort();

        String query = 'SELECT Id,' + String.join(orderedFields, ',') + ' FROM devcomply360__Clause__c WHERE Id = :recordId LIMIT 1';
        devcomply360__Clause__c existingClause;
        try {
            existingClause = Database.query(query);
        } catch (Exception ex) {
            throw new AuraHandledException('Unable to load the selected clause.');
        }

        if (editedValues == null) {
            editedValues = new Map<String, Object>();
        }

        String existingLifecycle = (String) existingClause.get(STATUS_FIELD);
        String requestedLifecycle = existingLifecycle;
        if (editedValues.containsKey(STATUS_FIELD) && editedValues.get(STATUS_FIELD) != null) {
            requestedLifecycle = String.valueOf(editedValues.get(STATUS_FIELD)).trim();
        }

        if (DIRECT_SAVE_STATUSES.contains(existingLifecycle)) {
            throw new AuraHandledException(
                'Version creation is not allowed when lifecycle status is ' + existingLifecycle + '.'
            );
        }

        if (ENFORCED_STATUS.equals(existingLifecycle) && !OBSOLETE_STATUS.equals(requestedLifecycle)) {
            throw new AuraHandledException('You can edit the values only in Obsolete state.');
        }

        Savepoint savepointRef = Database.setSavepoint();
        try {
            devcomply360__Clause__c newClause = existingClause.clone(false, false, false, false);
            applyEditedValues(newClause, editedValues, fieldMap);

            Schema.SObjectField versionFieldToken = fieldMap.get(VERSION_FIELD);
            if (versionFieldToken == null) {
                throw new AuraHandledException('Version field is not configured on Clause.');
            }

            String nextVersion = resolveNextVersion(existingClause.get(VERSION_FIELD), versionFieldToken.getDescribe());
            newClause.put(STATUS_FIELD, 'Draft');
            newClause.put(PARENT_FIELD, existingClause.Id);
            newClause.put(VERSION_FIELD, nextVersion);
            newClause.Name = buildVersionedClauseName(existingClause.Name, nextVersion);

            validateRequiredCreateFields(newClause, fieldMap);

            Database.SaveResult insertResult = Database.insert(newClause, false);
            if (!insertResult.isSuccess()) {
                throw new AuraHandledException('Unable to create new clause version: ' + formatDmlErrors(insertResult.getErrors()));
            }

            devcomply360__Clause__c obsoleteUpdate = new devcomply360__Clause__c(
                Id = existingClause.Id,
                devcomply360__Clause_Lifecycle_Status__c = 'Obsolete'
            );
            Database.SaveResult updateResult = Database.update(obsoleteUpdate, false);
            if (!updateResult.isSuccess()) {
                throw new AuraHandledException('Unable to mark old clause as Obsolete: ' + formatDmlErrors(updateResult.getErrors()));
            }

            return insertResult.getId();
        } catch (AuraHandledException ex) {
            Database.rollback(savepointRef);
            throw ex;
        } catch (Exception ex) {
            Database.rollback(savepointRef);
            throw new AuraHandledException('Unable to create new clause version. ' + ex.getMessage());
        }
    }

    private static void applyEditedValues(
        devcomply360__Clause__c targetClause,
        Map<String, Object> editedValues,
        Map<String, Schema.SObjectField> fieldMap
    ) {
        for (String fieldApiName : editedValues.keySet()) {
            if (!COPY_FIELDS.contains(fieldApiName)) {
                continue;
            }

            Schema.SObjectField fieldToken = fieldMap.get(fieldApiName);
            if (fieldToken == null) {
                continue;
            }

            Schema.DescribeFieldResult fieldDescribe = fieldToken.getDescribe();
            if (!fieldDescribe.isCreateable() || !fieldDescribe.isUpdateable()) {
                throw new AuraHandledException('You do not have permission to edit field: ' + fieldApiName);
            }

            Object convertedValue = convertValueByType(fieldApiName, editedValues.get(fieldApiName), fieldDescribe);
            targetClause.put(fieldApiName, convertedValue);
        }
    }

    private static Object convertValueByType(
        String fieldApiName,
        Object rawValue,
        Schema.DescribeFieldResult fieldDescribe
    ) {
        if (rawValue == null) {
            return null;
        }

        String asText = String.valueOf(rawValue).trim();
        if (asText == '') {
            return null;
        }

        Schema.DisplayType fieldType = fieldDescribe.getType();
        try {
            if (fieldType == Schema.DisplayType.Date) {
                if (asText.contains('T')) {
                    asText = asText.substring(0, 10);
                }
                return Date.valueOf(asText);
            }
            if (fieldType == Schema.DisplayType.DateTime) {
                return parseDateTime(asText);
            }
            if (
                fieldType == Schema.DisplayType.Double ||
                fieldType == Schema.DisplayType.Currency ||
                fieldType == Schema.DisplayType.Percent
            ) {
                return Decimal.valueOf(asText);
            }
            if (fieldType == Schema.DisplayType.Integer) {
                return Integer.valueOf(asText);
            }
            if (fieldType == Schema.DisplayType.Boolean) {
                return asText.toLowerCase() == 'true';
            }
            if (fieldType == Schema.DisplayType.Reference) {
                return asText;
            }

            return asText;
        } catch (Exception ex) {
            throw new AuraHandledException('Invalid value provided for field ' + fieldApiName + '.');
        }
    }

    private static Datetime parseDateTime(String rawValue) {
        String normalized = rawValue.replace('T', ' ');

        Integer dotIndex = normalized.indexOf('.');
        if (dotIndex > -1) {
            Integer zoneStart = normalized.indexOf('Z');
            if (zoneStart < 0) {
                zoneStart = normalized.indexOf('+', dotIndex);
            }
            if (zoneStart < 0) {
                zoneStart = normalized.indexOf('-', dotIndex);
            }
            String suffix = zoneStart > -1 ? normalized.substring(zoneStart) : '';
            normalized = normalized.substring(0, dotIndex) + suffix;
        }

        if (normalized.endsWith('Z')) {
            return Datetime.valueOfGmt(normalized.substring(0, normalized.length() - 1));
        }

        if (normalized.contains('+')) {
            normalized = normalized.substring(0, normalized.indexOf('+'));
            return Datetime.valueOf(normalized);
        }

        Integer timeDash = normalized.indexOf('-', 11);
        if (timeDash > -1) {
            normalized = normalized.substring(0, timeDash);
        }

        return Datetime.valueOf(normalized);
    }

    private static String resolveNextVersion(Object currentVersionObj, Schema.DescribeFieldResult versionDescribe) {
        String currentVersion = currentVersionObj == null ? '' : String.valueOf(currentVersionObj).trim();
        if (currentVersion == '') {
            throw new AuraHandledException('Current version is blank.');
        }

        if (!Pattern.matches('^[0-9]+$', currentVersion)) {
            throw new AuraHandledException('Current version is non-numeric: ' + currentVersion);
        }

        Integer currentAsNumber = Integer.valueOf(currentVersion);
        Integer nextAsNumber = currentAsNumber + 1;
        String nextVersion = String.valueOf(nextAsNumber);

        Set<String> validValues = new Set<String>();
        Integer highestNumericValue;
        for (Schema.PicklistEntry picklistEntry : versionDescribe.getPicklistValues()) {
            if (!picklistEntry.isActive()) {
                continue;
            }
            String picklistValue = picklistEntry.getValue();
            validValues.add(picklistValue);
            if (Pattern.matches('^[0-9]+$', picklistValue)) {
                Integer numericValue = Integer.valueOf(picklistValue);
                if (highestNumericValue == null || numericValue > highestNumericValue) {
                    highestNumericValue = numericValue;
                }
            }
        }

        if (!validValues.contains(currentVersion)) {
            throw new AuraHandledException('Current version value is invalid for picklist: ' + currentVersion);
        }

        if (!validValues.contains(nextVersion)) {
            if (highestNumericValue != null && currentAsNumber >= highestNumericValue) {
                throw new AuraHandledException('Maximum version reached. Cannot create another version.');
            }
            throw new AuraHandledException('Next version value is not available in picklist: ' + nextVersion);
        }

        return nextVersion;
    }

    private static void validateRequiredCreateFields(
        devcomply360__Clause__c newClause,
        Map<String, Schema.SObjectField> fieldMap
    ) {
        for (String fieldApiName : COPY_FIELDS) {
            Schema.SObjectField fieldToken = fieldMap.get(fieldApiName);
            if (fieldToken == null) {
                continue;
            }

            Schema.DescribeFieldResult fieldDescribe = fieldToken.getDescribe();
            if (!fieldDescribe.isCreateable() || fieldDescribe.isNillable() || fieldDescribe.isDefaultedOnCreate()) {
                continue;
            }

            Object value = newClause.get(fieldApiName);
            if (value == null || String.valueOf(value).trim() == '') {
                throw new AuraHandledException('Required field is missing: ' + fieldDescribe.getLabel());
            }
        }
    }

    private static String formatDmlErrors(Database.Error[] errors) {
        if (errors == null || errors.isEmpty()) {
            return 'Unknown DML error.';
        }

        List<String> messages = new List<String>();
        for (Database.Error err : errors) {
            messages.add(err.getMessage());
        }
        return String.join(messages, '; ');
    }

    private static String buildVersionedClauseName(String sourceName, String versionValue) {
        String baseName = String.isBlank(sourceName) ? 'Clause' : sourceName.trim();
        // Prevent repeated suffixes like "Clause - v4 - v5" on repeated versioning.
        baseName = baseName.replaceFirst('(?i)\\s*-\\s*v\\d+$', '');
        return baseName + ' - v' + versionValue;
    }
}

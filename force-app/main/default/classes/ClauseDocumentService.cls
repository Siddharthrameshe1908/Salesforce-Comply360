public with sharing class ClauseDocumentService {
    public class ViewerDocDTO {
        @AuraEnabled public String documentType;
        @AuraEnabled public String title;
        @AuraEnabled public String contentDocumentId;
        @AuraEnabled public String latestVersionId;
        @AuraEnabled public String downloadUrl;
        @AuraEnabled public String viewUrl;
        @AuraEnabled public String fileType;
        @AuraEnabled public Datetime lastModifiedDate;
    }

    @AuraEnabled(cacheable=true)
    public static List<ViewerDocDTO> getDocumentsForVersion(String versionValue) {
        if (String.isBlank(versionValue)) {
            return new List<ViewerDocDTO>();
        }

        List<Clause_Document_Map__c> maps = [
            SELECT Id, Version__c, Document_Type__c, Is_Active__c
            FROM Clause_Document_Map__c
            WHERE Version__c = :versionValue
              AND Is_Active__c = true
        ];

        if (maps.isEmpty()) {
            return new List<ViewerDocDTO>();
        }

        Set<Id> mapIds = new Set<Id>();
        for (Clause_Document_Map__c m : maps) {
            mapIds.add(m.Id);
        }

        Map<Id, String> mapIdToType = new Map<Id, String>();
        for (Clause_Document_Map__c m : maps) {
            mapIdToType.put(m.Id, m.Document_Type__c);
        }

        List<ContentDocumentLink> links = [
            SELECT LinkedEntityId,
                   ContentDocumentId,
                   ContentDocument.Title,
                   ContentDocument.FileType,
                   ContentDocument.LatestPublishedVersionId,
                   ContentDocument.LastModifiedDate
            FROM ContentDocumentLink
            WHERE LinkedEntityId IN :mapIds
        ];

        Map<String, ViewerDocDTO> byType = new Map<String, ViewerDocDTO>();

        for (ContentDocumentLink l : links) {
            String docType = mapIdToType.get(l.LinkedEntityId);
            if (String.isBlank(docType)) {
                continue;
            }

            ViewerDocDTO dto = new ViewerDocDTO();
            dto.documentType = docType;
            dto.title = l.ContentDocument.Title;
            dto.contentDocumentId = l.ContentDocumentId;
            dto.latestVersionId = l.ContentDocument.LatestPublishedVersionId;
            dto.fileType = l.ContentDocument.FileType;
            dto.lastModifiedDate = l.ContentDocument.LastModifiedDate;

            dto.downloadUrl = '/sfc/servlet.shepherd/document/download/' + l.ContentDocumentId;
            dto.viewUrl = '/sfc/servlet.shepherd/version/download/' + l.ContentDocument.LatestPublishedVersionId;

            // Keep one per type (latest modified wins if multiple accidentally exist)
            if (!byType.containsKey(docType) ||
                byType.get(docType).lastModifiedDate < dto.lastModifiedDate) {
                byType.put(docType, dto);
            }
        }

        List<String> order = new List<String>{ 'Compliance', 'Procedure', 'Work Instructions' };
        List<ViewerDocDTO> result = new List<ViewerDocDTO>();

        for (String t : order) {
            if (byType.containsKey(t)) {
                result.add(byType.get(t));
            }
        }
        return result;
    }
}

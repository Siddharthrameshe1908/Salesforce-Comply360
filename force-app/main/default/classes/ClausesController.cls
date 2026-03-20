public with sharing class ClausesController {

    public class ClauseCardDTO {
        @AuraEnabled public String clauseId;        // Record Id (used for click/selection)
        @AuraEnabled public String clauseNumber;    // Auto Number (CL-00011) -> display
        @AuraEnabled public String clauseName;
        @AuraEnabled public String riskLevel;
        @AuraEnabled public String status;
        @AuraEnabled public String industryDomain;
        @AuraEnabled public String reviewer;
        @AuraEnabled public String type;
        @AuraEnabled public String documentName;
    }

    @AuraEnabled(cacheable=true)
    public static List<ClauseCardDTO> getClauseCards(Id complianceId) {
        if (complianceId == null) return new List<ClauseCardDTO>();

        devcomply360__Compliance__c comp = [
            SELECT Id, Name, devcomply360__Industry_Domain__c, devcomply360__Content_Document_ID__c
            FROM devcomply360__Compliance__c
            WHERE Id = :complianceId
            LIMIT 1
        ];

        String docTitle = comp.Name;
        try {
            if (String.isNotBlank(comp.devcomply360__Content_Document_ID__c)) {
                List<ContentVersion> cvs = [
                    SELECT Title
                    FROM ContentVersion
                    WHERE ContentDocumentId = :comp.devcomply360__Content_Document_ID__c
                    AND IsLatest = true
                    LIMIT 1
                ];
                if (!cvs.isEmpty() && String.isNotBlank(cvs[0].Title)) docTitle = cvs[0].Title;
            }
        } catch (Exception e) { }

        List<devcomply360__Clause__c> clauses = [
            SELECT Id,
                   Name,
                   devcomply360__Clause_ID__c,
                   devcomply360__Risk_Level__c,
                   devcomply360__Review_Status__c,
                   devcomply360__Reviewer__c,
                   devcomply360__Clause_Type__c,
                   devcomply360__Source_Compliance__r.devcomply360__Industry_Domain__c
            FROM devcomply360__Clause__c
            WHERE devcomply360__Source_Compliance__c = :complianceId
            ORDER BY CreatedDate DESC
        ];

        List<ClauseCardDTO> outList = new List<ClauseCardDTO>();
        for (devcomply360__Clause__c c : clauses) {
            ClauseCardDTO dto = new ClauseCardDTO();
            dto.clauseId = (String)c.Id; // record id
            dto.clauseNumber = (String)c.devcomply360__Clause_ID__c; // CL-00011
            dto.clauseName = c.Name;
            dto.riskLevel = (String)c.devcomply360__Risk_Level__c;
            dto.status = (String)c.devcomply360__Review_Status__c;
            dto.reviewer = (String)c.devcomply360__Reviewer__c;
            dto.type = (String)c.devcomply360__Clause_Type__c;

            dto.industryDomain = (c.devcomply360__Source_Compliance__r != null)
                ? (String)c.devcomply360__Source_Compliance__r.devcomply360__Industry_Domain__c
                : (String)comp.devcomply360__Industry_Domain__c;

            dto.documentName = docTitle;
            outList.add(dto);
        }
        return outList;
    }
}
public with sharing class ClauseChatterController {

    public class FeedPostWrapper {
        @AuraEnabled public Id Id;
        @AuraEnabled public Id ParentId;
        @AuraEnabled public String Body;
        @AuraEnabled public String Type;
        @AuraEnabled public Datetime CreatedDate;
        @AuraEnabled public Id CreatedById;
        @AuraEnabled public String CreatedByName;
        @AuraEnabled public Integer LikeCount;
        @AuraEnabled public Boolean IsLikedByMe;
        @AuraEnabled public Boolean IsBookmarkedByMe;
        @AuraEnabled public List<FeedCommentWrapper> Comments = new List<FeedCommentWrapper>();
    }

    public class FeedCommentWrapper {
        @AuraEnabled public Id Id;
        @AuraEnabled public Id FeedItemId;
        @AuraEnabled public String CommentBody;
        @AuraEnabled public Datetime CreatedDate;
        @AuraEnabled public Id CreatedById;
        @AuraEnabled public String CreatedByName;
    }

    @AuraEnabled(cacheable=true)
    public static List<FeedPostWrapper> getChatterPosts(Id recordId, String sortBy) {
        if (recordId == null) {
            return new List<FeedPostWrapper>();
        }

        String orderByClause = ' ORDER BY CreatedDate DESC ';
        if (sortBy == 'OldestFirst') {
            orderByClause = ' ORDER BY CreatedDate ASC ';
        } else if (sortBy == 'LatestPost') {
            orderByClause = ' ORDER BY CreatedDate DESC ';
        } else if (sortBy == 'MostRecentActivity') {
            orderByClause = ' ORDER BY CreatedDate DESC ';
        }

        String soql =
            'SELECT Id, ParentId, Body, Type, CreatedDate, CreatedBy.Id, CreatedBy.Name ' +
            'FROM FeedItem ' +
            'WHERE ParentId = :recordId ' +
            'AND Type = \'TextPost\' ' +
            orderByClause +
            'LIMIT 100';

        List<FeedItem> feedItems = Database.query(soql);
        if (feedItems.isEmpty()) {
            return new List<FeedPostWrapper>();
        }

        Set<Id> feedItemIds = new Set<Id>();
        for (FeedItem item : feedItems) {
            feedItemIds.add(item.Id);
        }

        Map<Id, List<FeedCommentWrapper>> commentsByPostId = new Map<Id, List<FeedCommentWrapper>>();
        for (FeedComment fc : [
            SELECT Id, FeedItemId, CommentBody, CreatedDate, CreatedBy.Id, CreatedBy.Name
            FROM FeedComment
            WHERE FeedItemId IN :feedItemIds
            ORDER BY CreatedDate ASC
        ]) {
            if (!commentsByPostId.containsKey(fc.FeedItemId)) {
                commentsByPostId.put(fc.FeedItemId, new List<FeedCommentWrapper>());
            }

            FeedCommentWrapper c = new FeedCommentWrapper();
            c.Id = fc.Id;
            c.FeedItemId = fc.FeedItemId;
            c.CommentBody = fc.CommentBody;
            c.CreatedDate = fc.CreatedDate;
            c.CreatedById = fc.CreatedById;
            c.CreatedByName = fc.CreatedBy.Name;
            commentsByPostId.get(fc.FeedItemId).add(c);
        }

        List<FeedPostWrapper> results = new List<FeedPostWrapper>();
        for (FeedItem item : feedItems) {
            FeedPostWrapper w = new FeedPostWrapper();
            w.Id = item.Id;
            w.ParentId = item.ParentId;
            w.Body = item.Body;
            w.Type = item.Type;
            w.CreatedDate = item.CreatedDate;
            w.CreatedById = item.CreatedById;
            w.CreatedByName = item.CreatedBy.Name;
            w.LikeCount = 0;
            w.IsLikedByMe = false;
            w.IsBookmarkedByMe = false;
            w.Comments = commentsByPostId.containsKey(item.Id)
                ? commentsByPostId.get(item.Id)
                : new List<FeedCommentWrapper>();
            results.add(w);
        }

        return results;
    }

    @AuraEnabled
    public static void createPost(Id recordId, String body) {
        if (recordId == null) {
            throw new AuraHandledException('Record Id is required.');
        }
        if (String.isBlank(body)) {
            throw new AuraHandledException('Post body cannot be empty.');
        }

        FeedItem postItem = new FeedItem();
        postItem.ParentId = recordId;
        postItem.Body = body;
        postItem.IsRichText = true;
        postItem.Type = 'TextPost';
        insert postItem;
    }

    @AuraEnabled
    public static void addComment(Id feedItemId, String commentBody) {
        if (feedItemId == null) {
            throw new AuraHandledException('Feed item Id is required.');
        }
        if (String.isBlank(commentBody)) {
            throw new AuraHandledException('Comment body cannot be empty.');
        }

        FeedComment fc = new FeedComment();
        fc.FeedItemId = feedItemId;
        fc.CommentBody = commentBody;
        insert fc;
    }

    @AuraEnabled
    public static void likePost(Id feedItemId) {
        if (feedItemId == null) {
            throw new AuraHandledException('Feed item Id is required.');
        }

        ConnectApi.ChatterFeeds.likeFeedElement(
            Network.getNetworkId(),
            feedItemId
        );
    }

    @AuraEnabled
    public static void bookmarkPost(Id feedItemId, Boolean isBookmarked) {
        if (feedItemId == null) {
            throw new AuraHandledException('Feed item Id is required.');
        }

        ConnectApi.ChatterFeeds.updateFeedElementBookmarks(
            Network.getNetworkId(),
            feedItemId,
            isBookmarked
        );
    }

    @AuraEnabled
    public static void editPost(Id feedItemId, String body) {
        if (feedItemId == null) {
            throw new AuraHandledException('Feed item Id is required.');
        }
        if (String.isBlank(body)) {
            throw new AuraHandledException('Post body cannot be empty.');
        }

        FeedItem item = [
            SELECT Id, Body
            FROM FeedItem
            WHERE Id = :feedItemId
            LIMIT 1
        ];
        item.Body = body;
        update item;
    }

    @AuraEnabled
    public static void deletePost(Id feedItemId) {
        if (feedItemId == null) {
            throw new AuraHandledException('Feed item Id is required.');
        }

        FeedItem item = [
            SELECT Id
            FROM FeedItem
            WHERE Id = :feedItemId
            LIMIT 1
        ];
        delete item;
    }

    @AuraEnabled(cacheable=true)
    public static List<User> searchUsers(String keyword) {
        if (String.isBlank(keyword)) {
            return new List<User>();
        }
        
        String likeValue = keyword.trim() + '%';
        
        return [
        SELECT Id, Name
        FROM User
        WHERE IsActive = true
        AND Name LIKE :likeValue
        ORDER BY Name
        LIMIT 5
    ];
    }
    
    @AuraEnabled
    public static void createPostWithMentions(Id recordId, String segmentsJson) {
        if (recordId == null) {
            throw new AuraHandledException('Record Id is required.');
        }
        if (String.isBlank(segmentsJson)) {
            throw new AuraHandledException('Message content is required.');
        }
        
        List<Object> parsed = (List<Object>) JSON.deserializeUntyped(segmentsJson);
        List<ConnectApi.MessageSegmentInput> segments = new List<ConnectApi.MessageSegmentInput>();
        
        for (Object obj : parsed) {
            Map<String, Object> segment = (Map<String, Object>) obj;
            String typeValue = (String) segment.get('type');
            
            if (typeValue == 'Text') {
                String text = (String) segment.get('text');
                if (!String.isBlank(text)) {
                    ConnectApi.TextSegmentInput textSeg = new ConnectApi.TextSegmentInput();
                    textSeg.text = text;
                    segments.add(textSeg);
                }
            } else if (typeValue == 'Mention') {
                String userId = (String) segment.get('userId');
                if (!String.isBlank(userId)) {
                    ConnectApi.MentionSegmentInput mentionSeg = new ConnectApi.MentionSegmentInput();
                    mentionSeg.id = userId;
                    segments.add(mentionSeg);
                }
            }
        }
        
        if (segments.isEmpty()) {
            throw new AuraHandledException('Message content is required.');
        }
        
        ConnectApi.MessageBodyInput bodyInput = new ConnectApi.MessageBodyInput();
        bodyInput.messageSegments = segments;
        
        ConnectApi.FeedItemInput input = new ConnectApi.FeedItemInput();
        input.body = bodyInput;
        input.feedElementType = ConnectApi.FeedElementType.FeedItem;
        input.subjectId = recordId;
        
        ConnectApi.ChatterFeeds.postFeedElement(Network.getNetworkId(), input);
    }
}
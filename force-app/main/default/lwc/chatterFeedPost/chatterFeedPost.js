import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import addComment from '@salesforce/apex/ClauseChatterController.addComment';
import likePost from '@salesforce/apex/ClauseChatterController.likePost';
import unlikePost from '@salesforce/apex/ClauseChatterController.unlikePost';
import deletePost from '@salesforce/apex/ClauseChatterController.deletePost';
import editPost from '@salesforce/apex/ClauseChatterController.editPost';
import bookmarkPost from '@salesforce/apex/ClauseChatterController.bookmarkPost';

export default class ChatterFeedPost extends LightningElement {
    _post;
    @api
    get post() {
        return this._post;
    }
    set post(value) {
        this._post = value;
        this.syncLocalStateFromPost();
    }

    @track isCommentBoxOpen = false;
    @track commentBody = '';
    @track isBusy = false;
    @track isEditMode = false;
    @track editBody = '';

    localIsLiked = false;
    localLikeCount = 0;
    localIsBookmarked = false;

    connectedCallback() {
        this.syncLocalStateFromPost();
    }

    get createdByName() {
        return this.post?.CreatedByName || 'Unknown User';
    }

    get createdDateValue() {
        const raw = this.post?.CreatedDate;
        const parsed = raw ? Date.parse(raw) : null;
        return Number.isNaN(parsed) ? null : parsed;
    }

    get normalizedComments() {
        return (this.post?.Comments || []).map((comment) => {
            const parsed = comment?.CreatedDate ? Date.parse(comment.CreatedDate) : null;
            return {
                ...comment,
                createdDateValue: Number.isNaN(parsed) ? null : parsed
            };
        });
    }

    get likeLabel() {
        return this.localIsLiked ? 'Liked' : 'Like';
    }

    get likeIcon() {
        return 'utility:like';
    }

    get bookmarkLabel() {
        return this.localIsBookmarked ? 'Remove Bookmark' : 'Bookmark';
    }

    get hasLikes() {
        return this.localLikeCount > 0;
    }

    get hasComments() {
        return (this.post?.Comments?.length || 0) > 0;
    }

    get commentCountLabel() {
        const count = this.post?.Comments?.length || 0;
        return `${count} comment(s)`;
    }

    get isAddCommentDisabled() {
        return !this.commentBody || !this.commentBody.trim() || this.isBusy;
    }

    get isSaveEditDisabled() {
        return !this.editBody || !this.editBody.trim() || this.isBusy;
    }

    toggleCommentBox() {
        this.isCommentBoxOpen = !this.isCommentBoxOpen;
    }

    handleCommentChange(event) {
        this.commentBody = event.target.value;
    }

    handleEditChange(event) {
        this.editBody = event.target.value;
    }

    cancelEdit() {
        this.isEditMode = false;
        this.editBody = this.post?.Body || '';
    }

    async saveEdit() {
        if (this.isSaveEditDisabled) {
            return;
        }

        this.isBusy = true;
        try {
            await editPost({
                feedItemId: this.post.Id,
                body: this.editBody
            });

            this.showToast('Success', 'Post updated successfully.', 'success');
            this.isEditMode = false;
            this.dispatchEvent(new CustomEvent('refreshfeed'));
        } catch (error) {
            this.showToast('Error', this.reduceError(error), 'error');
        } finally {
            this.isBusy = false;
        }
    }

    async handleAddComment() {
        if (this.isAddCommentDisabled) {
            return;
        }

        this.isBusy = true;
        try {
            await addComment({
                feedItemId: this.post.Id,
                commentBody: this.commentBody
            });

            this.commentBody = '';
            this.isCommentBoxOpen = false;
            this.showToast('Success', 'Comment added successfully.', 'success');
            this.dispatchEvent(new CustomEvent('refreshfeed'));
        } catch (error) {
            this.showToast('Error', this.reduceError(error), 'error');
        } finally {
            this.isBusy = false;
        }
    }

    async handleLikeClick() {
        if (this.isBusy) {
            return;
        }

        this.isBusy = true;
        try {
            if (this.localIsLiked) {
                await unlikePost({ feedItemId: this.post.Id });
                this.localIsLiked = false;
                this.localLikeCount = Math.max((this.localLikeCount || 1) - 1, 0);
            } else {
                await likePost({ feedItemId: this.post.Id });
                this.localIsLiked = true;
                this.localLikeCount = (this.localLikeCount || 0) + 1;
            }

            this.dispatchEvent(new CustomEvent('refreshfeed'));
        } catch (error) {
            this.showToast('Error', this.reduceError(error), 'error');
        } finally {
            this.isBusy = false;
        }
    }

    async handleMenuSelect(event) {
        const action = event.detail.value;

        if (action === 'edit') {
            this.isEditMode = true;
            return;
        }

        if (action === 'bookmark') {
            this.isBusy = true;
            try {
                const newState = !this.localIsBookmarked;
                await bookmarkPost({
                    feedItemId: this.post.Id,
                    isBookmarked: newState
                });
                this.localIsBookmarked = newState;
                this.showToast(
                    'Success',
                    newState ? 'Bookmark was added.' : 'Bookmark was removed.',
                    'success'
                );
                this.dispatchEvent(new CustomEvent('refreshfeed'));
            } catch (error) {
                this.showToast('Error', this.reduceError(error), 'error');
            } finally {
                this.isBusy = false;
            }
            return;
        }

        if (action === 'delete') {
            this.isBusy = true;
            try {
                await deletePost({ feedItemId: this.post.Id });
                this.showToast('Success', 'Post deleted successfully.', 'success');
                this.dispatchEvent(new CustomEvent('refreshfeed'));
            } catch (error) {
                this.showToast('Error', this.reduceError(error), 'error');
            } finally {
                this.isBusy = false;
            }
        }
    }

    showToast(title, message, variant, mode = 'dismissable') {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant,
                mode
            })
        );
    }

    reduceError(error) {
        if (Array.isArray(error?.body)) {
            return error.body.map((e) => e.message).join(', ');
        }
        return error?.body?.message || error?.message || 'Unknown error';
    }

    syncLocalStateFromPost() {
        this.localIsLiked = !!this.post?.IsLikedByMe;
        this.localLikeCount = this.post?.LikeCount || 0;
        this.localIsBookmarked = !!this.post?.IsBookmarkedByMe;

        if (!this.isEditMode) {
            this.editBody = this.post?.Body || '';
        }
    }
}


import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

import getChatterPosts from '@salesforce/apex/ClauseChatterController.getChatterPosts';
import createPost from '@salesforce/apex/ClauseChatterController.createPost';

export default class ClauseChatterPanel extends LightningElement {
    @api recordId;

    @track commentBody = '';
    @track posts = [];
    @track isLoading = false;

    sortBy = 'MostRecentActivity';
    searchText = '';
    wiredPostsResult;

    @wire(getChatterPosts, {
        recordId: '$recordId',
        sortBy: '$sortBy'
    })
    wiredPosts(result) {
        this.wiredPostsResult = result;

        const { data, error } = result;
        if (data) {
            this.posts = data;
        } else if (error) {
            this.posts = [];
            this.showToast('Error', this.reduceError(error), 'error');
        }
    }

    get filteredPosts() {
        const text = (this.searchText || '').trim().toLowerCase();
        if (!text) {
            return this.posts;
        }

        return (this.posts || []).filter((post) => {
            const body = (post.Body || '').toLowerCase();
            const author = (post.CreatedByName || '').toLowerCase();
            return body.includes(text) || author.includes(text);
        });
    }

    get hasPosts() {
        return this.filteredPosts && this.filteredPosts.length > 0;
    }

    get isPostDisabled() {
        return !this.recordId || !this.commentBody || !this.commentBody.trim();
    }

    get sortOptions() {
        return [
            { label: 'Most Recent Activity', value: 'MostRecentActivity' },
            { label: 'Latest Post', value: 'LatestPost' },
            { label: 'Oldest First', value: 'OldestFirst' }
        ];
    }

    handleChange(event) {
        this.commentBody = event.target.value;
    }

    handleSortChange(event) {
        this.sortBy = event.detail.value;
    }

    handleSearchChange(event) {
        this.searchText = event.target.value || '';
    }

    async handleRefresh() {
        this.isLoading = true;
        try {
            await refreshApex(this.wiredPostsResult);
        } catch (error) {
            this.showToast('Error', this.reduceError(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handlePostClick() {
        if (this.isPostDisabled) {
            return;
        }

        this.isLoading = true;

        try {
            await createPost({
                recordId: this.recordId,
                body: this.commentBody
            });

            this.commentBody = '';
            this.showToast('Success', 'Post created successfully.', 'success');
            await refreshApex(this.wiredPostsResult);
        } catch (error) {
            this.showToast('Error', this.reduceError(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }

    reduceError(error) {
        if (Array.isArray(error?.body)) {
            return error.body.map((e) => e.message).join(', ');
        }
        return error?.body?.message || error?.message || 'Unknown error';
    }
}
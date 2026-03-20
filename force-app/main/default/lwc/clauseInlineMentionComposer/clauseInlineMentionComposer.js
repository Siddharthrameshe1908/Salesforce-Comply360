import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import searchUsers from '@salesforce/apex/ClauseChatterController.searchUsers';
import createPostWithMentions from '@salesforce/apex/ClauseChatterController.createPostWithMentions';

export default class ClauseInlineMentionComposer extends LightningElement {
    @api recordId;

    @track suggestions = [];
    @track showSuggestions = false;

    caretRange = null;
    currentQuery = '';

    get editor() {
        return this.template.querySelector('[data-editor]');
    }

    get plainText() {
        return this.editor?.innerText?.trim() || '';
    }

    get isPostDisabled() {
        return !this.recordId || !this.plainText;
    }

    get showPlaceholder() {
        return !this.plainText;
    }

    handleInput(event) {
        this.captureCaret();

        const text = event.target.innerText || '';
        const match = text.match(/@([a-zA-Z0-9._-]*)$/);

        if (match) {
            this.currentQuery = match[1] || '';
            if (this.currentQuery.length > 0) {
                this.fetchUserSuggestions(this.currentQuery);
            } else {
                this.showSuggestions = false;
                this.suggestions = [];
            }
        } else {
            this.showSuggestions = false;
            this.suggestions = [];
        }
    }

    handleKeyUp() {
        this.captureCaret();
    }

    handleBlur() {
        window.setTimeout(() => {
            this.showSuggestions = false;
        }, 200);
    }

    captureCaret() {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            this.caretRange = selection.getRangeAt(0).cloneRange();
        }
    }

    async fetchUserSuggestions(keyword) {
        try {
            const result = await searchUsers({ keyword });
            this.suggestions = result || [];
            this.showSuggestions = this.suggestions.length > 0;
        } catch (error) {
            this.showSuggestions = false;
            this.suggestions = [];
            this.showToast('Error', this.reduceError(error), 'error');
        }
    }

    handleSelectUser(event) {
        const userId = event.currentTarget.dataset.id;
        const userName = event.currentTarget.dataset.name;

        if (!this.caretRange) {
            return;
        }

        const range = this.caretRange;
        const selection = window.getSelection();
        const startContainer = range.startContainer;

        if (!startContainer || startContainer.nodeType !== Node.TEXT_NODE) {
            return;
        }

        const text = startContainer.textContent || '';
        const atIndex = text.lastIndexOf('@');
        if (atIndex === -1) {
            return;
        }

        const beforeText = text.substring(0, atIndex);
        const afterNode = document.createTextNode('\u00A0');
        const beforeNode = document.createTextNode(beforeText);

        const mentionNode = document.createElement('span');
        mentionNode.className = 'mention-token';
        mentionNode.dataset.id = userId;
        mentionNode.textContent = `@${userName}`;
        mentionNode.contentEditable = 'false';

        const parent = startContainer.parentNode;
        parent.replaceChild(afterNode, startContainer);
        parent.insertBefore(mentionNode, afterNode);
        parent.insertBefore(beforeNode, mentionNode);

        const newRange = document.createRange();
        newRange.setStart(afterNode, afterNode.textContent.length);
        newRange.collapse(true);

        selection.removeAllRanges();
        selection.addRange(newRange);

        this.showSuggestions = false;
        this.suggestions = [];
    }

    buildSegments() {
        const nodes = Array.from(this.editor.childNodes);
        const segments = [];

        nodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent) {
                    segments.push({
                        type: 'Text',
                        text: node.textContent
                    });
                }
            } else if (
                node.nodeType === Node.ELEMENT_NODE &&
                node.classList.contains('mention-token')
            ) {
                segments.push({
                    type: 'Mention',
                    userId: node.dataset.id
                });
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const text = node.textContent;
                if (text) {
                    segments.push({
                        type: 'Text',
                        text
                    });
                }
            }
        });

        return segments;
    }

    async handlePost() {
        if (this.isPostDisabled) {
            return;
        }

        try {
            const segments = this.buildSegments();

            await createPostWithMentions({
                recordId: this.recordId,
                segmentsJson: JSON.stringify(segments)
            });

            this.editor.innerHTML = '';
            this.showSuggestions = false;
            this.suggestions = [];

            this.dispatchEvent(new CustomEvent('postsuccess'));
        } catch (error) {
            this.showToast('Error', this.reduceError(error), 'error');
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
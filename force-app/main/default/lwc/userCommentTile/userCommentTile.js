import { LightningElement, api } from 'lwc';

export default class UserCommentTile extends LightningElement {
    @api userComment;

    get createdByName() {
        return this.userComment?.CreatedBy?.Name || 'Unknown User';
    }

    get createdDate() {
        const raw = this.userComment?.CreatedDate;
        if (!raw) {
            return null;
        }

        const time = Date.parse(raw);
        return Number.isNaN(time) ? null : time;
    }
}
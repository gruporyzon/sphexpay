export type SocialProfile={userId:string;username:string;displayName:string;bio:string;avatarUrl?:string;coverUrl?:string;website?:string;location?:string;badges:string[];followers?:number;following?:number}
export type SocialMedia={id:string;type:'image'|'video';url:string}
export type SocialPost={id:string;authorId:string;body:string;createdAt:string;updatedAt:string;replyToId?:string;repostOfId?:string;profile:SocialProfile;media:SocialMedia[];likes:number;comments:number;reposts:number;liked:boolean;bookmarked:boolean;following:boolean}
export type SocialNotice={id:string;recipientId:string;actorId?:string;type:'follow'|'like'|'comment'|'reply'|'repost'|'mention'|'message';entityType:'post'|'profile'|'conversation';entityId:string;readAt?:string;createdAt:string;actor?:SocialProfile}
export type SocialConversation={id:string;updatedAt:string;members:SocialProfile[];unread:number}
export type SocialMessage={id:string;conversationId:string;senderId:string;body:string;createdAt:string;deletedAt?:string}
export type FeedMode='for-you'|'following'|'saved'|'tag'

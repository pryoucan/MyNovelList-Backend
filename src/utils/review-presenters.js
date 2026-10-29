const likeFields = (viewerId) => viewerId
  ? { likes: { where: { userId: viewerId }, select: { userId: true } } }
  : {};

export const reviewSelect = (viewerId) => ({
  id: true, userId: true, novelId: true, body: true, isSpoiler: true,
  createdAt: true, editedAt: true,
  user: { select: { username: true } },
  _count: { select: { likes: true } },
  ...likeFields(viewerId),
});

export const replySelect = (viewerId) => ({
  id: true, reviewId: true, parentId: true, userId: true, body: true,
  createdAt: true, editedAt: true, deletedAt: true,
  user: { select: { username: true } },
  _count: { select: { likes: true } },
  ...likeFields(viewerId),
});

export const presentReview = ({ user, _count, likes = [], ...review }) => ({
  ...review,
  username: user.username,
  likesCount: _count.likes,
  likedByMe: likes.length > 0,
  replies: [],
});

export const presentReply = ({ user, _count, likes = [], ...reply }) => ({
  ...reply,
  username: user.username,
  likesCount: reply.deletedAt ? 0 : _count.likes,
  likedByMe: reply.deletedAt ? false : likes.length > 0,
  children: [],
});

export const attachReplies = (reviews, replies) => {
  const byReview = new Map(reviews.map((review) => [review.id, review]));
  const byReply = new Map(replies.map((reply) => [reply.id, reply]));
  for (const reply of replies) {
    const parent = reply.parentId && byReply.get(reply.parentId);
    if (parent && parent.reviewId === reply.reviewId) parent.children.push(reply);
    else byReview.get(reply.reviewId)?.replies.push(reply);
  }
  return reviews;
};

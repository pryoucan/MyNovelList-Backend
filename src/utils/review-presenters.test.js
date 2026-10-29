import test from "node:test";
import assert from "node:assert/strict";
import { attachReplies, presentReply } from "./review-presenters.js";

test("attaches replies at any depth without losing sibling order", () => {
  const reviews = [{ id: "review", replies: [] }];
  const replies = [
    { id: "first", reviewId: "review", parentId: null, children: [] },
    { id: "second", reviewId: "review", parentId: "first", children: [] },
    { id: "third", reviewId: "review", parentId: "second", children: [] },
    { id: "sibling", reviewId: "review", parentId: null, children: [] },
  ];
  const result = attachReplies(reviews, replies);
  assert.deepEqual(result[0].replies.map((reply) => reply.id), ["first", "sibling"]);
  assert.equal(result[0].replies[0].children[0].children[0].id, "third");
});

test("deleted replies keep their place but expose no body or active likes", () => {
  const reply = presentReply({
    id: "deleted", body: null, deletedAt: new Date(),
    user: { username: "Reader" }, _count: { likes: 4 }, likes: [{ userId: "viewer" }],
  });
  assert.equal(reply.body, null);
  assert.equal(reply.likesCount, 0);
  assert.equal(reply.likedByMe, false);
  assert.deepEqual(reply.children, []);
});

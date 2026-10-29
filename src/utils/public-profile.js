export const presentPublicUser = (user, avatar) => ({
  username: user.username,
  role: user.role,
  avatar,
  createdAt: user.createdAt,
});

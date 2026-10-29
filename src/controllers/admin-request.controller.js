import { prisma } from "../config/db.config.js";
import { deleteObject } from "../config/storage.config.js";
import { isUuid, isUniqueViolation } from "../utils/serializers.js";
import {
  approveAddRequest,
  approveEditRequest,
  serializeAddRequest,
  serializeEditRequest,
  ADD_INCLUDE,
  EDIT_INCLUDE,
} from "../utils/novel-requests.js";

const STATUSES = ["PENDING", "APPROVED", "REJECTED"];
const LIST_LIMIT = 50;

const models = {
  new: { model: () => prisma.novelAddRequest, include: ADD_INCLUDE, serialize: serializeAddRequest },
  edit: { model: () => prisma.novelEditRequest, include: EDIT_INCLUDE, serialize: serializeEditRequest },
};

// GET /api/admin/requests?status=PENDING&type=new|edit
// Pending: oldest first (first come, first reviewed). Reviewed: newest first.
const listRequests = async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : "PENDING";
  const types = req.query.type in models ? [req.query.type] : ["new", "edit"];
  const order = status === "PENDING" ? "asc" : "desc";

  try {
    const lists = await Promise.all(
      types.map(async (type) => {
        const { model, include, serialize } = models[type];
        const rows = await model().findMany({
          where: { status },
          include,
          orderBy: { [status === "PENDING" ? "createdAt" : "reviewedAt"]: order },
          take: LIST_LIMIT,
        });
        return Promise.all(rows.map(serialize));
      })
    );

    const key = status === "PENDING" ? "createdAt" : "reviewedAt";
    const requests = lists
      .flat()
      .sort((a, b) => (order === "asc" ? 1 : -1) * (new Date(a[key]) - new Date(b[key])));

    const [newPending, editPending] = await Promise.all([
      prisma.novelAddRequest.count({ where: { status: "PENDING" } }),
      prisma.novelEditRequest.count({ where: { status: "PENDING" } }),
    ]);

    return res.status(200).json({
      message: "Requests fetched",
      status,
      pending: { new: newPending, edit: editPending },
      requests,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const findPending = async (type, id) => {
  if (!(type in models) || !isUuid(id)) return { error: [404, "Request not found"] };
  const request = await models[type].model().findUnique({ where: { id } });
  if (!request) return { error: [404, "Request not found"] };
  if (request.status !== "PENDING") return { error: [409, "This request was already reviewed"] };
  return { request };
};

// POST /api/admin/requests/:type/:id/approve
const approveRequest = async (req, res) => {
  const { type, id } = req.params;
  try {
    const { request, error } = await findPending(type, id);
    if (error) return res.status(error[0]).json({ message: error[1] });

    if (type === "new") {
      const novel = await approveAddRequest(request, req.user.id);
      return res.status(200).json({ message: "Approved — novel added", novelId: novel.id });
    }

    const novel = await prisma.globalNovel.findUnique({ where: { id: request.novelId }, select: { id: true } });
    if (!novel) return res.status(410).json({ message: "This novel no longer exists" });
    await approveEditRequest(request, req.user.id);
    return res.status(200).json({ message: "Approved — novel updated", novelId: request.novelId });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ message: "A novel with this title and author already exists" });
    }
    // CHECK constraint (e.g. end year before start year after other edits)
    if (error?.code === "P2004" || /check constraint/i.test(error?.message ?? "")) {
      return res.status(400).json({ message: "These changes conflict with the novel's current details" });
    }
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// POST /api/admin/requests/:type/:id/reject  { reason? }
const rejectRequest = async (req, res) => {
  const { type, id } = req.params;
  try {
    const { request, error } = await findPending(type, id);
    if (error) return res.status(error[0]).json({ message: error[1] });

    await models[type].model().update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        reviewNote: req.body.reason?.trim() || null,
        coverKey: null, // deleted below; history shouldn't point at a missing file
      },
    });
    // The proposed cover will never be used.
    await deleteObject(request.coverKey);
    return res.status(200).json({ message: "Request rejected" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export { listRequests, approveRequest, rejectRequest };

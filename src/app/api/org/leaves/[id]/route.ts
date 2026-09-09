import { NextResponse } from 'next/server';
import { requireOrgMember, requireOrgAdmin } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';

const ALLOWED: Record<string, string> = { APPROVED: 'APPROVED', REJECTED: 'REJECTED' };

/** PATCH — admin approuve / rejette une demande de congé. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOrgAdmin();
  if (auth.error) return auth.error;
  const { status } = await request.json();
  if (!ALLOWED[status]) return NextResponse.json({ error: 'Statut inconnu.' }, { status: 400 });
  try {
    const leave = await prisma.leaveRequest.findFirst({ where: { id: params.id, organizationId: auth.ctx.organizationId } });
    if (!leave) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
    const updated = await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: { status: ALLOWED[status] as any, decidedById: auth.ctx.user.id, decidedAt: new Date() },
    });
    // Notifie le demandeur du résultat.
    await prisma.notification.create({
      data: {
        user: { connect: { id: leave.userId } }, organization: { connect: { id: auth.ctx.organizationId } },
        title: `Demande de congé ${status === 'APPROVED' ? 'approuvée' : 'rejetée'}`,
        content: `Votre demande du ${leave.startDate.toLocaleDateString('fr-FR')} au ${leave.endDate.toLocaleDateString('fr-FR')} a été ${status === 'APPROVED' ? 'approuvée' : 'rejetée'}.`,
      },
    }).catch(() => {});
    return NextResponse.json({ leave: updated, ok: true });
  } catch {
    return NextResponse.json({ error: 'Statut impossible à appliquer.' }, { status: 400 });
  }
}

/** DELETE — annule (supprime) une demande de congé : par son auteur ou un admin, uniquement si encore PENDING. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;
  const leave = await prisma.leaveRequest.findFirst({ where: { id: params.id, organizationId: auth.ctx.organizationId } });
  if (!leave) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
  const isOwner = leave.userId === auth.ctx.user.id;
  const isAdmin = auth.ctx.orgRole === 'ORGANIZATION_ADMIN';
  if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Vous ne pouvez pas annuler cette demande.' }, { status: 403 });
  if (leave.status !== 'PENDING') return NextResponse.json({ error: 'Seules les demandes en attente peuvent être annulées.' }, { status: 400 });
  await prisma.leaveRequest.delete({ where: { id: leave.id } });
  return NextResponse.json({ ok: true, message: 'Demande annulée.' });
}
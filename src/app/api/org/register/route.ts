import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createSession, publicUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';

/**
 * Création d'une organisation + du compte responsable.
 * Le rôle ORGANIZATION_ADMIN est attribué STRICTEMENT côté serveur :
 * le client ne peut jamais soumettre un rôle.
 */
const schema = z.object({
  organization: z.object({
    name: z.string().trim().min(2).max(120),
    sector: z.string().trim().max(120).optional(),
    country: z.string().trim().max(80).optional(),
    contactEmail: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().max(30).optional(),
  }),
  responsible: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8).max(72),
  }),
});

function slugify(value: string) {
  const base = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return base || 'organisation';
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());

    // Slug unique garanti côté serveur.
    let slug = slugify(input.organization.name);
    let suffix = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${slugify(input.organization.name)}-${suffix}`;
    }

    const duplicate = await prisma.user.findFirst({ where: { OR: [{ username: input.responsible.username }, { email: input.responsible.email }] } });
    if (duplicate) return NextResponse.json({ error: "Ce nom d'utilisateur ou cet email est déjà utilisé." }, { status: 409 });

    const passwordHash = await bcrypt.hash(input.responsible.password, 12);
    // Rôle plateforme : uniquement via TASKPULSE_ADMIN_EMAIL (jamais depuis le client).
    const platformEmail = (process.env.TASKPULSE_ADMIN_EMAIL ?? '').trim().toLowerCase();
    const platformRole = platformEmail && platformEmail === input.responsible.email ? 'PLATFORM_SUPER_ADMIN' as const : 'USER' as const;

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.organization.name,
          slug,
          sector: input.organization.sector || null,
          country: input.organization.country || null,
          contactEmail: input.organization.contactEmail,
          phone: input.organization.phone || null,
        },
      });
      const user = await tx.user.create({
        data: {
          firstName: input.responsible.firstName,
          lastName: input.responsible.lastName,
          username: input.responsible.username,
          email: input.responsible.email,
          passwordHash,
          platformRole,
        },
      });
      // Rôle ORGANIZATION_ADMIN attribué par le serveur.
      await tx.membership.create({ data: { userId: user.id, organizationId: organization.id, role: 'ORGANIZATION_ADMIN' } });
      await tx.user.update({ where: { id: user.id }, data: { activeOrganizationId: organization.id } });
      await tx.systemSetting.create({ data: { key: 'organizationName', value: organization.name, organizationId: organization.id } });
      return { organization, user };
    });

    await writeAudit(result.user.id, 'CREATION_ORGANISATION', 'Organization', result.organization.id, { name: result.organization.name, slug: result.organization.slug });
    await createSession(result.user.id);

    const full = await prisma.user.findUnique({
      where: { id: result.user.id },
      include: { department: true, profile: true, memberships: { include: { organization: true }, orderBy: { createdAt: 'asc' } } },
    });
    return NextResponse.json({ organization: { id: result.organization.id, name: result.organization.name, slug: result.organization.slug }, user: publicUser(full!) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 });
    return NextResponse.json({ error: 'Impossible de créer cette organisation.' }, { status: 400 });
  }
}
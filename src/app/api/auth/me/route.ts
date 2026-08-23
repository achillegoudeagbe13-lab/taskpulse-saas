import { NextResponse } from 'next/server';
import { getCurrentUser, publicUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    return user ? NextResponse.json({ user: publicUser(user) }) : NextResponse.json({ error: 'Session inexistante.' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Impossible de charger le profil.' }, { status: 500 });
  }
}
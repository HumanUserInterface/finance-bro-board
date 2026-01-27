import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { BoardDeliberation } from '../types/deliberation.js';

export interface Session {
  id: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  deliberations: BoardDeliberation[];
  activePersonas: string[];
}

export interface SessionSummary {
  id: string;
  name?: string;
  createdAt: Date;
  deliberationCount: number;
  totalApproved: number;
  totalRejected: number;
  totalSpentApproved: number;
}

export class SessionStore {
  private dataDir: string;
  private sessionsDir: string;
  private currentSession: Session | null = null;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.sessionsDir = join(dataDir, 'sessions');
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  createSession(name?: string, activePersonas: string[] = []): Session {
    const session: Session = {
      id: randomUUID(),
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
      deliberations: [],
      activePersonas,
    };

    this.currentSession = session;
    this.saveSession(session);
    return session;
  }

  loadSession(id: string): Session | null {
    const filePath = join(this.sessionsDir, `${id}.json`);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const session = JSON.parse(content) as Session;
      session.createdAt = new Date(session.createdAt);
      session.updatedAt = new Date(session.updatedAt);
      this.currentSession = session;
      return session;
    } catch {
      return null;
    }
  }

  saveSession(session: Session): void {
    const filePath = join(this.sessionsDir, `${session.id}.json`);
    session.updatedAt = new Date();
    writeFileSync(filePath, JSON.stringify(session, null, 2));
  }

  addDeliberation(deliberation: BoardDeliberation): void {
    if (!this.currentSession) {
      this.createSession();
    }

    this.currentSession!.deliberations.push(deliberation);
    this.saveSession(this.currentSession!);
  }

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  getOrCreateSession(activePersonas: string[]): Session {
    if (this.currentSession) {
      return this.currentSession;
    }

    // Try to load most recent session
    const sessions = this.listSessions();
    if (sessions.length > 0) {
      const mostRecent = sessions[0];
      const loaded = this.loadSession(mostRecent.id);
      if (loaded) {
        return loaded;
      }
    }

    return this.createSession(undefined, activePersonas);
  }

  listSessions(): SessionSummary[] {
    if (!existsSync(this.sessionsDir)) {
      return [];
    }

    const files = readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'));
    const summaries: SessionSummary[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(join(this.sessionsDir, file), 'utf-8');
        const session = JSON.parse(content) as Session;

        const approvedCount = session.deliberations.filter(
          (d) => d.votingResult.finalDecision === 'approve'
        ).length;
        const rejectedCount = session.deliberations.filter(
          (d) => d.votingResult.finalDecision === 'reject'
        ).length;
        const totalSpent = session.deliberations
          .filter((d) => d.votingResult.finalDecision === 'approve')
          .reduce((sum, d) => sum + d.purchase.price, 0);

        summaries.push({
          id: session.id,
          name: session.name,
          createdAt: new Date(session.createdAt),
          deliberationCount: session.deliberations.length,
          totalApproved: approvedCount,
          totalRejected: rejectedCount,
          totalSpentApproved: totalSpent,
        });
      } catch {
        // Skip invalid files
      }
    }

    // Sort by most recent first
    return summaries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getDeliberationHistory(sessionId?: string): BoardDeliberation[] {
    if (sessionId) {
      const session = this.loadSession(sessionId);
      return session?.deliberations ?? [];
    }

    if (this.currentSession) {
      return this.currentSession.deliberations;
    }

    return [];
  }
}

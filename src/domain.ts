export type Condition = 'attic' | 'noMirrors' | 'noPeople' | 'damp' | 'dark' | 'quiet';
export const conditionLabels: Record<Condition, string> = {
  attic: 'Нужен чердак',
  noMirrors: 'Боится зеркал',
  noPeople: 'Без людей',
  damp: 'Любит сырость',
  dark: 'Нужна темнота',
  quiet: 'Нужна тишина',
};
export interface Ghost {
  portrait?: number;
  id: string;
  name: string;
  anxiety: number;
  temperature: number;
  deadline: string;
  conditions: Condition[];
}
export interface Place {
  image?: string;
  id: string;
  name: string;
  description: string;
  capacity: number;
  temperature: number;
  light: number;
  noise: number;
  humidity: number;
  people: boolean;
  mirrors: boolean;
  attic: boolean;
  maxAnxiety: number;
}
export type Assignments = Record<string, string>;
export interface Evaluation {
  score: number;
  conflicts: string[];
  explanation: string;
}

// A common contract lets the service compose and substitute independent rules.
export abstract class SuitabilityRule {
  abstract check(ghost: Ghost, place: Place): string[];
}
export class ConditionsRule extends SuitabilityRule {
  check(g: Ghost, p: Place): string[] {
    const failures: Record<Condition, boolean> = {
      attic: !p.attic,
      noMirrors: p.mirrors,
      noPeople: p.people,
      damp: p.humidity < 65,
      dark: p.light > 30,
      quiet: p.noise > 30,
    };
    return g.conditions
      .filter((c) => failures[c])
      .map((c) => `${conditionLabels[c]}: условие не выполнено`);
  }
}
export class AnxietyRule extends SuitabilityRule {
  check(g: Ghost, p: Place) {
    return g.anxiety > p.maxAnxiety ? [`Допустимая тревожность здесь — до ${p.maxAnxiety}/10`] : [];
  }
}
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export class RelocationService {
  constructor(
    private readonly rules: readonly SuitabilityRule[] = [new ConditionsRule(), new AnxietyRule()],
  ) {}
  evaluate(g: Ghost, p: Place, today: string): Evaluation {
    const conflicts = this.rules.flatMap((rule) => rule.check(g, p));
    if (g.deadline < today) conflicts.push('Дедлайн просрочен: продлите срок перед переселением');
    const temperaturePenalty = Math.min(60, Math.abs(g.temperature - p.temperature) * 4);
    const noisePenalty = Math.round((p.noise * g.anxiety) / 25);
    const score = Math.max(0, 100 - temperaturePenalty - noisePenalty);
    return {
      score,
      conflicts,
      explanation: `Комфорт ${score}/100: температура ${p.temperature} °C (желательно ${g.temperature} °C), шум ${p.noise}/100. Обязательные условия ${conflicts.length ? 'нарушены' : 'выполнены'}.`,
    };
  }
  conflicts(g: Ghost, p: Place, assignments: Assignments, today: string): string[] {
    const occupied = Object.entries(assignments).filter(
      ([id, place]) => id !== g.id && place === p.id,
    ).length;
    return [
      ...this.evaluate(g, p, today).conflicts,
      ...(occupied >= p.capacity
        ? [`Нет свободных мест: занято ${occupied} из ${p.capacity}`]
        : []),
    ];
  }
  // Successive shortest augmenting paths: maximum count first, then maximum total comfort.
  // Reverse edges can move an earlier ghost, preventing greedy allocation dead ends.
  allocate(ghosts: readonly Ghost[], places: readonly Place[], today: string): Assignments {
    type Edge = { to: number; reverse: number; capacity: number; cost: number };
    const source = 0,
      firstGhost = 1,
      firstPlace = firstGhost + ghosts.length,
      sink = firstPlace + places.length;
    const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
    const add = (a: number, b: number, capacity: number, cost: number) => {
      graph[a].push({ to: b, reverse: graph[b].length, capacity, cost });
      graph[b].push({ to: a, reverse: graph[a].length - 1, capacity: 0, cost: -cost });
    };
    ghosts.forEach((g, i) => {
      add(source, firstGhost + i, 1, 0);
      places.forEach((p, j) => {
        const e = this.evaluate(g, p, today);
        if (!e.conflicts.length) add(firstGhost + i, firstPlace + j, 1, -e.score);
      });
    });
    places.forEach((p, j) => add(firstPlace + j, sink, p.capacity, 0));
    while (true) {
      const distance = Array(sink + 1).fill(Infinity),
        previous: [number, number][] = [];
      distance[source] = 0;
      const queue = [source],
        queued = new Set([source]);
      for (let q = 0; q < queue.length; q++) {
        const u = queue[q];
        queued.delete(u);
        graph[u].forEach((e, i) => {
          if (e.capacity > 0 && distance[e.to] > distance[u] + e.cost) {
            distance[e.to] = distance[u] + e.cost;
            previous[e.to] = [u, i];
            if (!queued.has(e.to)) {
              queued.add(e.to);
              queue.push(e.to);
            }
          }
        });
      }
      if (!Number.isFinite(distance[sink])) break;
      for (let v = sink; v !== source;) {
        const [u, i] = previous[v],
          e = graph[u][i];
        e.capacity--;
        graph[v][e.reverse].capacity++;
        v = u;
      }
    }
    const result: Assignments = {};
    ghosts.forEach((g, i) => {
      const edge = graph[firstGhost + i].find(
        (e) => e.to >= firstPlace && e.to < sink && e.capacity === 0,
      );
      if (edge) result[g.id] = places[edge.to - firstPlace].id;
    });
    return result;
  }
}
export const relocation = new RelocationService();

/** The stencil set JSON served by `GET /rest/stencil-sets/{editor|cmmneditor|dmneditor}`. */
export interface StencilSetJson {
  title: string;
  namespace: string;
  description?: string;
  propertyPackages: PropertyPackageJson[];
  stencils: StencilJson[];
  rules: {
    connectionRules?: { role: string; connects: { from: string; to: string[] }[] }[];
    containmentRules?: { role: string; contains: string[] }[];
    morphingRules?: { role: string; baseMorphs: string[]; preserveBounds?: boolean }[];
    cardinalityRules?: unknown[];
  };
}

export interface PropertyPackageJson {
  name: string;
  properties: PropertyJson[];
}

export interface PropertyJson {
  id: string;
  type: string;
  title: string;
  value?: unknown;
  description?: string;
  popular?: boolean;
  refToView?: string | string[];
  items?: { id?: string; title?: string; value: string; refToView?: string }[];
}

export interface StencilJson {
  type: 'node' | 'edge';
  id: string;
  title: string;
  description?: string;
  icon?: string;
  groups?: string[];
  roles?: string[];
  view: string;
  propertyPackages?: string[];
  hiddenPropertyPackages?: string[];
  removed?: boolean;
  hide?: boolean;
  mayBeRoot?: boolean;
}

/** A stencil property with its key normalised the way Oryx does (lower-cased id and type). */
export interface StencilProperty {
  /** JSON key: the lower-cased stencil property id. */
  key: string;
  /** Lower-cased type, e.g. `string`, `boolean`, `complex`, `flowable-multiinstance`. */
  type: string;
  title: string;
  description: string;
  /** Default value, as the stencil gives it (strings like `"false"` or `""`). */
  defaultValue: unknown;
  refToView: string[];
  items: { value: string; title: string; refToView?: string }[];
  hidden: boolean;
}

export interface Stencil {
  id: string;
  type: 'node' | 'edge';
  title: string;
  description: string;
  icon: string;
  group: string | null;
  /** Roles as listed in the JSON (the Flowable UI code uses these raw roles). */
  rawRoles: string[];
  /** Raw roles plus the stencil's own id, as Oryx matches rules. */
  roles: Set<string>;
  view: string;
  properties: StencilProperty[];
  removed: boolean;
}

export interface PaletteGroup {
  title: string;
  items: Stencil[];
}

/** Stencils that the palette does not list (the edges are drawn from the quick menu instead). */
const PALETTE_IGNORED = new Set([
  'SequenceFlow',
  'MessageFlow',
  'Association',
  'DataAssociation',
  'DataStore',
  'SendTask',
]);

/** Indexed stencil set with the rule checks the editor needs. */
export class StencilSet {
  readonly namespace: string;
  readonly stencils: Stencil[];
  private readonly byId = new Map<string, Stencil>();
  private readonly connections = new Map<string, Map<string, Set<string>>>();
  private readonly containment = new Map<string, Set<string>>();
  private readonly morphing: { role: string; baseMorphs: string[]; preserveBounds: boolean }[];

  constructor(readonly json: StencilSetJson) {
    this.namespace = json.namespace;
    const packages = new Map(json.propertyPackages.map((p) => [p.name, p.properties]));
    this.stencils = json.stencils.map((s) => {
      const hidden = new Set(s.hiddenPropertyPackages ?? []);
      const properties: StencilProperty[] = [];
      for (const name of s.propertyPackages ?? []) {
        for (const p of packages.get(name) ?? []) {
          properties.push({
            key: p.id.toLowerCase(),
            type: p.type.toLowerCase(),
            title: p.title,
            description: p.description ?? '',
            defaultValue: p.value ?? '',
            refToView: p.refToView == null ? [] : ([] as string[]).concat(p.refToView),
            items: (p.items ?? []).map((i) => ({
              value: i.value,
              title: i.title ?? i.value,
              refToView: i.refToView,
            })),
            hidden: hidden.has(name),
          });
        }
      }
      const rawRoles = s.roles ?? [];
      const stencil: Stencil = {
        id: s.id,
        type: s.type,
        title: s.title,
        description: s.description ?? '',
        icon: s.icon ?? '',
        group: s.groups?.[0] ?? null,
        rawRoles,
        roles: new Set([...rawRoles, s.id]),
        view: s.view,
        properties,
        removed: !!s.removed,
      };
      this.byId.set(s.id, stencil);
      return stencil;
    });

    for (const rule of json.rules.connectionRules ?? []) {
      const map = this.connections.get(rule.role) ?? new Map<string, Set<string>>();
      for (const c of rule.connects) {
        const to = map.get(c.from) ?? new Set<string>();
        c.to.forEach((t) => to.add(t));
        map.set(c.from, to);
      }
      this.connections.set(rule.role, map);
    }
    for (const rule of json.rules.containmentRules ?? []) {
      const set = this.containment.get(rule.role) ?? new Set<string>();
      rule.contains.forEach((c) => set.add(c));
      this.containment.set(rule.role, set);
    }
    this.morphing = (json.rules.morphingRules ?? []).map((r) => ({
      role: r.role,
      baseMorphs: r.baseMorphs ?? [],
      preserveBounds: !!r.preserveBounds,
    }));
  }

  stencil(id: string): Stencil | undefined {
    return this.byId.get(id);
  }

  /** The root stencil (BPMNDiagram, CMMNDiagram, DMNDiagram). */
  get rootStencil(): Stencil {
    return (
      this.stencils.find((s) => this.json.stencils.find((j) => j.id === s.id)?.mayBeRoot) ??
      this.stencils[0]
    );
  }

  edgeStencils(): Stencil[] {
    return this.stencils.filter((s) => s.type === 'edge');
  }

  /** Oryx `canConnect`: may `edge` connect `source` to `target`? Either end may be omitted. */
  canConnect(edge: Stencil, source?: Stencil, target?: Stencil): boolean {
    const rules = new Map<string, Set<string>>();
    for (const role of edge.roles) {
      for (const [from, to] of this.connections.get(role) ?? []) {
        const set = rules.get(from) ?? new Set<string>();
        to.forEach((t) => set.add(t));
        rules.set(from, set);
      }
    }
    if (!rules.size) return false;
    if (source) {
      for (const role of source.roles) {
        const to = rules.get(role);
        if (!to) continue;
        if (!target) return true;
        for (const t of target.roles) if (to.has(t)) return true;
      }
      return false;
    }
    if (target) {
      for (const to of rules.values()) for (const t of target.roles) if (to.has(t)) return true;
      return false;
    }
    return true;
  }

  /** The edge stencil used to connect two nodes (Oryx `connectMorph`), or null. */
  connectingEdge(source: Stencil, target: Stencil): Stencil | null {
    return this.edgeStencils().find((e) => this.canConnect(e, source, target)) ?? null;
  }

  /** May `parent` contain `child`? (Oryx `canContain`.) */
  canContain(parent: Stencil, child: Stencil): boolean {
    if (child.type === 'edge') return false;
    for (const role of parent.roles) {
      const contains = this.containment.get(role);
      if (!contains) continue;
      for (const r of child.roles) if (contains.has(r)) return true;
    }
    return false;
  }

  /** Is this stencil a boundary event that attaches to an activity's border? */
  isBoundaryEvent(stencil: Stencil): boolean {
    return stencil.rawRoles.includes('IntermediateEventOnActivityBoundary');
  }

  /** May `event` be attached to `host`'s border? */
  canAttach(host: Stencil, event: Stencil): boolean {
    return this.isBoundaryEvent(event) && this.canConnect(event, host, event);
  }

  /** The morph family of a stencil (last matching morph role among its raw roles). */
  morphRule(stencil: Stencil) {
    let found: (typeof this.morphing)[number] | undefined;
    for (const rule of this.morphing) if (stencil.rawRoles.includes(rule.role)) found = rule;
    return found;
  }

  /** Stencils a shape can change into, excluding itself. */
  morphOptions(stencil: Stencil): Stencil[] {
    const rule = this.morphRule(stencil);
    if (!rule) return [];
    return this.stencils.filter(
      (s) => s.id !== stencil.id && !s.removed && s.rawRoles.includes(rule.role),
    );
  }

  /** Palette groups in order of first appearance, without the diagram stencil and hidden items. */
  paletteGroups(): PaletteGroup[] {
    const groups = new Map<string, PaletteGroup>();
    for (const s of this.stencils) {
      if (!s.group || s.removed || /\.DIAGRAM$|^Diagram$/i.test(s.group)) continue;
      const group = groups.get(s.group) ?? { title: s.group, items: [] };
      groups.set(s.group, group);
      if (!PALETTE_IGNORED.has(s.id)) group.items.push(s);
    }
    return [...groups.values()].filter((g) => g.items.length);
  }

  /** Default property values for a new shape of this stencil. */
  defaultProperties(stencil: Stencil): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    for (const p of stencil.properties) props[p.key] = structuredClone(p.defaultValue);
    return props;
  }
}

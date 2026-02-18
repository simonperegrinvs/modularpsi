import { describe, it, expect } from 'vitest';
import { parseCategoriesXml, parseGraphmlXml, parseMpsiNodeXml, importLegacyData } from '../legacy-import';

describe('parseCategoriesXml', () => {
  it('parses category blocks from XML', () => {
    const xml = `
      <categories>
        <category>
          <id>gen</id>
          <name>General</name>
          <color>255,0,0</color>
          <description>Test</description>
        </category>
        <category>
          <id>bio</id>
          <name>Biology</name>
          <color>0,255,0</color>
          <description></description>
        </category>
      </categories>
    `;
    const cats = parseCategoriesXml(xml);
    expect(cats).toHaveLength(2);
    expect(cats[0].id).toBe('gen');
    expect(cats[0].name).toBe('General');
    expect(cats[0].color).toBe('#ff0000');
    expect(cats[1].color).toBe('#00ff00');
  });

  it('returns defaults when no categories found', () => {
    const cats = parseCategoriesXml('');
    expect(cats.length).toBeGreaterThan(0);
    expect(cats[0].id).toBe('general');
  });
});

describe('parseGraphmlXml', () => {
  it('extracts node IDs', () => {
    const xml = `
      <graphml>
        <numnodes>3</numnodes>
        <graph>
          <node id="P1"/>
          <node id="P2"/>
          <node id="P3"/>
        </graph>
      </graphml>
    `;
    const result = parseGraphmlXml(xml);
    expect(result.nodeIds).toEqual(['P1', 'P2', 'P3']);
    expect(result.lastNodeNumber).toBe(3);
  });

  it('returns 0 lastNodeNumber when tag missing', () => {
    const xml = '<graphml><graph><node id="P1"/></graph></graphml>';
    const result = parseGraphmlXml(xml);
    expect(result.nodeIds).toEqual(['P1']);
    expect(result.lastNodeNumber).toBe(0);
  });
});

describe('parseMpsiNodeXml', () => {
  it('extracts all fields from a node file', () => {
    const xml = `
      <mpsi>
        <id>P2</id>
        <name>Test Node</name>
        <description>A description</description>
        <category>bio</category>
        <keywords>alpha;beta;gamma</keywords>
        <mode>0</mode>
        <reference>ref1</reference>
        <reference>ref2</reference>
        <edge id="P2-P3" target="P3">
          <trust>0.8</trust>
          <type>0</type>
        </edge>
        <edge id="P2-P4" target="P4">
          <trust>-1</trust>
          <type>1</type>
        </edge>
      </mpsi>
    `;
    const node = parseMpsiNodeXml(xml);
    expect(node.id).toBe('P2');
    expect(node.name).toBe('Test Node');
    expect(node.description).toBe('A description');
    expect(node.categoryId).toBe('bio');
    expect(node.keywords).toEqual(['alpha', 'beta', 'gamma']);
    expect(node.type).toBe(0);
    expect(node.referenceIds).toEqual(['ref1', 'ref2']);
    expect(node.edges).toHaveLength(2);
    expect(node.edges[0]).toEqual({ id: 'P2-P3', targetId: 'P3', trust: 0.8, type: 0 });
    expect(node.edges[1]).toEqual({ id: 'P2-P4', targetId: 'P4', trust: -1, type: 1 });
  });

  it('throws on invalid XML without mpsi root', () => {
    expect(() => parseMpsiNodeXml('<invalid/>')).toThrow('no <mpsi> root element');
  });
});

describe('importLegacyData', () => {
  it('imports a minimal legacy dataset end-to-end', () => {
    const files = new Map<string, string>();

    files.set('cats.mpsi', `
      <categories>
        <category>
          <id>gen</id>
          <name>General</name>
          <color>0,0,0</color>
          <description></description>
        </category>
      </categories>
    `);

    files.set('prop.graphml', `
      <graphml>
        <numnodes>3</numnodes>
        <graph>
          <node id="P1"/>
          <node id="P2"/>
          <node id="P3"/>
        </graph>
      </graphml>
    `);

    files.set('P1.mpsi', `
      <mpsi>
        <id>P1</id>
        <name>Root</name>
        <description></description>
        <category>gen</category>
        <keywords></keywords>
        <mode>0</mode>
        <edge id="P1-P2" target="P2">
          <trust>0.8</trust>
          <type>0</type>
        </edge>
        <edge id="P1-P3" target="P3">
          <trust>0.6</trust>
          <type>0</type>
        </edge>
      </mpsi>
    `);

    files.set('P2.mpsi', `
      <mpsi>
        <id>P2</id>
        <name>Child A</name>
        <description></description>
        <category>gen</category>
        <keywords></keywords>
        <mode>0</mode>
      </mpsi>
    `);

    files.set('P3.mpsi', `
      <mpsi>
        <id>P3</id>
        <name>Child B</name>
        <description></description>
        <category>gen</category>
        <keywords></keywords>
        <mode>0</mode>
      </mpsi>
    `);

    const data = importLegacyData(files);

    expect(data.version).toBe(1);
    expect(data.prefix).toBe('P');
    expect(data.rootId).toBe('P1');
    expect(data.lastNodeNumber).toBe(3);
    expect(data.nodes).toHaveLength(3);
    expect(data.edges).toHaveLength(2);
    expect(data.hypotheses).toEqual([]);

    // Root should have trust=1.0
    const root = data.nodes.find(n => n.id === 'P1')!;
    expect(root.trust).toBe(1.0);

    // Children should have propagated trust
    const childA = data.nodes.find(n => n.id === 'P2')!;
    expect(childA.trust).toBeCloseTo(0.8);

    const childB = data.nodes.find(n => n.id === 'P3')!;
    expect(childB.trust).toBeCloseTo(0.6);
  });

  it('throws when no graphml file found', () => {
    const files = new Map<string, string>();
    files.set('cats.mpsi', '');
    expect(() => importLegacyData(files)).toThrow('No prop.graphml or model.graphml found');
  });

  it('creates stub nodes for missing .mpsi files', () => {
    const files = new Map<string, string>();
    files.set('prop.graphml', '<graphml><graph><node id="P1"/><node id="P2"/></graph></graphml>');
    files.set('P1.mpsi', `
      <mpsi>
        <id>P1</id>
        <name>Root</name>
        <description></description>
        <category>gen</category>
        <keywords></keywords>
        <mode>0</mode>
        <edge id="P1-P2" target="P2">
          <trust>0.5</trust>
          <type>0</type>
        </edge>
      </mpsi>
    `);
    // P2.mpsi is intentionally missing

    const data = importLegacyData(files);
    const stub = data.nodes.find(n => n.id === 'P2')!;
    expect(stub.name).toBe('P2'); // stub uses ID as name
  });
});

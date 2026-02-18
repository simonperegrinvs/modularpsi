#!/bin/bash
# Build the psi-literature knowledge graph - Phase B, Steps 5-6
# ~40 references + trust assignments
set -e

CLI="npx tsx src/cli/index.ts"
F="-f $HOME/data/modularpsi/psi-literature.json"
FMT="--format quiet"

ref_add() {
  $CLI $F $FMT ref add --title "$1" --authors "$2" --year "$3" --description "$4"
}

ref_link() {
  $CLI $F $FMT ref link "$1" "$2"
}

edge_trust() {
  $CLI $F $FMT edge update "$1" --trust "$2"
}

echo "=== Adding References ==="

echo "--- Foundational Physics ---"
ref_add "A Mathematical Theory of Communication" "Shannon, Claude E." 1948 \
  "Information theory foundations; defines entropy, channel capacity, coding theorems"
ref_add "Time Symmetry in the Quantum Process of Measurement" "Aharonov, Yakir;Bergmann, Peter G.;Lebowitz, Joel L." 1964 \
  "TSVF: time-symmetric quantum measurement theory with pre- and post-selected ensembles"
ref_add "A Single Quantum Cannot Be Cloned" "Wootters, William K.;Zurek, Wojciech H." 1982 \
  "No-cloning theorem constraining quantum information copying"
ref_add "Bell's Theorem and the Different Concepts of Locality" "Eberhard, Philippe H.;Ross, Ronald R." 1989 \
  "Proof that quantum field theory cannot provide faster-than-light communication"
ref_add "Loophole-free Bell inequality violation using electron spins" "Hensen, Bas;Bernien, Hannes;et al." 2015 \
  "First loophole-free Bell test confirming quantum non-locality at Delft"
ref_add "On the Gravitization of Quantum Mechanics" "Penrose, Roger" 2014 \
  "Gravitization of QM; objective reduction framework underlying Orch-OR"
ref_add "Wholeness and the Implicate Order" "Bohm, David" 1980 \
  "Implicate/explicate order; holographic interpretation of reality"
ref_add "The holographic principle" "Bousso, Raphael" 2002 \
  "Comprehensive review of holographic principle and Bekenstein entropy bounds"
ref_add "Gravitational Waves and Gamma-Rays from a Binary Neutron Star Merger: GW170817 and GRB 170817A" "Abbott, Benjamin P.;et al." 2017 \
  "Constrains gravity propagation speed to c, falsifying gravity-wave psi carrier hypothesis"

echo "--- Ganzfeld / ESP ---"
ref_add "Psi communication in the ganzfeld: Experiments with an automated testing system" "Honorton, Charles;Berger, Rick E.;et al." 1990 \
  "Autoganzfeld studies establishing the modern ganzfeld paradigm for telepathy research"
ref_add "Meta-analysis of free-response studies, 1992-2008" "Storm, Lance;Tressoldi, Patrizio E.;Di Risio, Lorenzo" 2010 \
  "Psychological Bulletin ganzfeld meta-analysis reporting positive hit rates"
ref_add "Parapsychology in search of a paradigm: Will the real experiment please stand up?" "Hyman, Ray" 2010 \
  "Critique of Storm et al. 2010 ganzfeld meta-analysis; methodological objections"
ref_add "Ganzfeld and remote viewing registered report" "Tressoldi, Patrizio E.;Storm, Lance;Radin, Dean" 2024 \
  "Stage 2 registered report: ES~0.074-0.084 for ganzfeld anomalous cognition"

echo "--- Precognition / Presentiment ---"
ref_add "Feeling the Future: Experimental Evidence for Anomalous Retroactive Influences on Cognition and Affect" "Bem, Daryl J." 2011 \
  "Nine precognition experiments (d~0.22); sparked major replication crisis debate in psychology"
ref_add "Correcting the past: Failures to replicate psi" "Galak, Jeff;LeBoeuf, Robyn A.;Nelson, Leif D.;Simmons, Joseph P." 2012 \
  "Large-scale Bem replications across seven experiments yielding d=0.04 (null)"
ref_add "Predictive physiological anticipation preceding seemingly unpredictable stimuli: a meta-analysis" "Mossbridge, Julia A.;Tressoldi, Patrizio E.;Utts, Jessica" 2012 \
  "Meta-analysis of presentiment experiments showing anticipatory physiological signals"
ref_add "Why psychologists must change the way they analyze their data: The case of psi" "Wagenmakers, Eric-Jan;Wetzels, Ruud;Borsboom, Denny;van der Maas, Han L.J." 2011 \
  "Bayesian critique of Bem's methods; demonstrates evidence favors null hypothesis"

echo "--- PK / RNG ---"
ref_add "PK Effect on Pre-Recorded Targets" "Schmidt, Helmut" 1976 \
  "Foundational micro-PK experiments using pre-recorded random events"
ref_add "Examining Psychokinesis: The Interaction of Human Intention With Random Number Generators" "Bosch, Holger;Steinkamp, Fiona;Boller, Emil" 2006 \
  "RNG-PK meta-analysis: tiny effect size with publication bias pattern"

echo "--- Consciousness / NDE / OBE ---"
ref_add "AWARE - AWAreness during REsuscitation" "Parnia, Sam;et al." 2014 \
  "Multi-center prospective study of consciousness during cardiac arrest"
ref_add "AWAreness during REsuscitation - II" "Parnia, Sam;et al." 2023 \
  "AWARE-II: no visual target confirmed in near-death experience study"

echo "--- Microtubule / Quantum Biology ---"
ref_add "Consciousness in the universe: A review of the 'Orch OR' theory" "Hameroff, Stuart;Penrose, Roger" 2014 \
  "Updated review of Orchestrated Objective Reduction theory of consciousness"
ref_add "Electronic energy migration in microtubules" "Kalra, Aarat P.;et al." 2023 \
  "Electronic excitation can propagate along microtubules; relevant to quantum biology claims"
ref_add "Anesthetic modulation of microtubule dynamics and consciousness" "Khan, Shahzad;et al." 2024 \
  "Epothilone B delays anesthetic-induced unconsciousness, supporting microtubule role in consciousness"
ref_add "Underground test of gravity-related wave function collapse" "Donadi, Sandro;et al." 2021 \
  "Constrains Penrose-style gravity-related collapse models; limits on Orch-OR parameters"

echo "--- Psychological / Methodology ---"
ref_add "Psi and internal attention states" "Irwin, Harvey J." 1985 \
  "Psi phenomena and absorption/dissociation domain; personality correlates of psi"
ref_add "Clairvoyance: conscious vs unconscious psi" "Braud, William G." 1975 \
  "Comparison of conscious and unconscious modes of clairvoyance"
ref_add "Theories of the Psi Process" "Stokes, Douglas M." 1987 \
  "Critical survey of major theoretical frameworks proposed to explain psi"
ref_add "The Conscious Universe" "Radin, Dean" 1997 \
  "Comprehensive overview of experimental psi evidence and meta-analyses"
ref_add "The experimental evidence for parapsychological phenomena: A review" "Cardena, Etzel" 2018 \
  "American Psychologist review summarizing experimental evidence across psi domains"

echo "--- Skeptical / Critical ---"
ref_add "The Adventures of a Psi Inhibitory Experimenter" "Blackmore, Susan" 1986 \
  "Skeptical perspective from a formerly sympathetic researcher; personal failure to replicate"
ref_add "Give the Null Hypothesis a Chance" "Alcock, James E." 2003 \
  "Argument that psi research has not met basic scientific standards of replicability"
ref_add "Replication of an anomalous process of information transfer" "Wiseman, Richard;Milton, Julie" 1999 \
  "Failed replication and critique of SAIC remote viewing experiments"

echo "--- Cultural / Social ---"
ref_add "Magical Thinking in Formal Operational Adults" "Lesser, Ira M.;Paisner, Morton" 1985 \
  "Persistence of magical thinking in adults with formal operational cognition"
ref_add "Wings of Illusion: The Origin, Nature and Future of Paranormal Belief" "Schumaker, John F." 1990 \
  "Paranormal belief as cognitive defense mechanism serving psychological needs"

echo "--- Additional key references ---"
ref_add "Psi-Mediated Instrumental Response" "Stanford, Rex G." 1974 \
  "PMIR model: psi as an unconscious process serving organism's instrumental needs"
ref_add "The Global Consciousness Project" "Nelson, Roger D.;et al." 2002 \
  "Worldwide network of RNGs testing for consciousness-correlated deviations"
ref_add "Does psi exist? Replicable evidence for an anomalous process of information transfer" "Bem, Daryl J.;Honorton, Charles" 1994 \
  "Autoganzfeld meta-analysis: 35% hit rate vs 25% chance, establishing ganzfeld paradigm"
ref_add "An Assessment of the Evidence for Psychic Functioning" "Utts, Jessica" 1996 \
  "Statistical assessment for US government concluding evidence for psi is compelling"
ref_add "The conscious universe revisited" "Radin, Dean" 2006 \
  "Updated overview of psi meta-analyses across multiple paradigms"

echo ""
echo "=== Linking References to Nodes ==="

# Foundational Physics refs -> nodes
ref_link ref-1 P18   # Shannon -> Quantum Non-Locality (information theory context)
ref_link ref-2 P24   # Aharonov -> TSVF
ref_link ref-2 P25   # Aharonov -> Time-Symmetric QM for Precognition
ref_link ref-3 P18   # No-cloning -> Quantum Non-Locality
ref_link ref-4 P19   # Eberhard -> No-Signaling Constraint
ref_link ref-5 P18   # Hensen Bell test -> Quantum Non-Locality
ref_link ref-5 P76   # Hensen -> Loophole-Free Bell Tests
ref_link ref-6 P35   # Penrose -> Orch-OR
ref_link ref-6 P78   # Penrose -> Gravity-Related Collapse
ref_link ref-7 P21   # Bohm -> Implicate Order
ref_link ref-8 P22   # Bousso -> Holographic Principle
ref_link ref-9 P30   # GW170817 -> Gravity Carrier (falsified)

# Ganzfeld / ESP refs -> nodes
ref_link ref-10 P6   # Honorton autoganzfeld -> Ganzfeld Evidence
ref_link ref-10 P67  # Honorton -> Autoganzfeld Protocol
ref_link ref-11 P6   # Storm meta -> Ganzfeld Evidence
ref_link ref-11 P68  # Storm -> Ganzfeld Meta-Analyses
ref_link ref-12 P6   # Hyman critique -> Ganzfeld Evidence
ref_link ref-12 P68  # Hyman -> Ganzfeld Meta-Analyses
ref_link ref-13 P6   # Tressoldi registered report -> Ganzfeld Evidence
ref_link ref-13 P68  # Tressoldi -> Ganzfeld Meta-Analyses

# Precognition / Presentiment refs -> nodes
ref_link ref-14 P10  # Bem -> Bem Precognition
ref_link ref-15 P61  # Galak -> Bem Replication Failures
ref_link ref-15 P10  # Galak -> Bem Precognition (shows failure)
ref_link ref-16 P11  # Mossbridge -> Presentiment
ref_link ref-16 P71  # Mossbridge -> Electrodermal Presentiment
ref_link ref-17 P10  # Wagenmakers -> Bem Precognition (critique)

# PK / RNG refs -> nodes
ref_link ref-18 P74  # Schmidt -> Schmidt RNG Experiments
ref_link ref-18 P32  # Schmidt -> Observational Theory
ref_link ref-19 P14  # Bosch -> Micro-PK
ref_link ref-19 P50  # Bosch -> Publication Bias (shows pattern)

# Consciousness / NDE refs -> nodes
ref_link ref-20 P66  # AWARE -> AWARE-II NDE Results
ref_link ref-21 P66  # AWARE-II -> AWARE-II NDE Results

# Microtubule / Quantum Biology refs -> nodes
ref_link ref-22 P35  # Hameroff-Penrose -> Orch-OR
ref_link ref-23 P36  # Kalra -> Microtubule Excitation
ref_link ref-24 P37  # Khan -> Anesthetic Effects
ref_link ref-25 P78  # Donadi -> Gravity-Related Collapse (constrains)

# Psychological / Methodology refs -> nodes
ref_link ref-26 P43  # Irwin -> Psi-Conducive Variables
ref_link ref-27 P39  # Braud -> Unconscious Processing
ref_link ref-28 P46  # Stokes -> Theoretical Frameworks
ref_link ref-29 P6   # Radin -> Ganzfeld Evidence (overview)
ref_link ref-30 P4   # Cardena -> Phenomenological Evidence

# Skeptical refs -> nodes
ref_link ref-31 P55  # Blackmore -> Cognitive Explanations
ref_link ref-32 P55  # Alcock -> Cognitive Explanations
ref_link ref-33 P7   # Wiseman -> Remote Viewing

# Cultural refs -> nodes
ref_link ref-34 P55  # Lesser -> Cognitive Explanations
ref_link ref-35 P55  # Schumaker -> Cognitive Explanations

# Additional refs -> nodes
ref_link ref-36 P44  # Stanford PMIR -> PMIR
ref_link ref-37 P14  # Nelson GCP -> Micro-PK
ref_link ref-38 P6   # Bem-Honorton -> Ganzfeld Evidence
ref_link ref-38 P67  # Bem-Honorton -> Autoganzfeld Protocol
ref_link ref-39 P7   # Utts -> Remote Viewing
ref_link ref-40 P4   # Radin 2006 -> Phenomenological Evidence

echo ""
echo "=== Setting Edge Trust Values ==="

# Top level
edge_trust P1-P2 0.5  # psi exist: uncertain, moderate prior
edge_trust P1-P3 0.8  # psi don't exist: conventional science favors this

# Under P2 -> section holders
edge_trust P2-P4  0.6  # phenomenological evidence: moderate support
edge_trust P2-P16 0.5  # physical mechanisms: speculative but grounded
edge_trust P2-P33 0.4  # biological: early-stage research
edge_trust P2-P42 0.6  # psychological factors: well-documented moderators
edge_trust P2-P46 0.3  # theoretical frameworks: speculative

# ESP branch
edge_trust P4-P5  0.7  # ESP container
edge_trust P5-P6  0.6  # Ganzfeld: meta-analytic support, contested
edge_trust P5-P7  0.4  # Remote Viewing: mixed evidence
edge_trust P5-P8  0.3  # Telepathic Dream Studies: limited modern replication
edge_trust P4-P9  0.4  # Precognition: contested
edge_trust P9-P10 0.2  # Bem: replications failed
edge_trust P9-P11 0.4  # Presentiment: meta-analysis exists, critiques strong
edge_trust P9-P12 0.2  # Retro-PK: very speculative
edge_trust P4-P13 0.3  # PK: weak evidence base
edge_trust P13-P14 0.2 # Micro-PK: tiny effect, publication bias
edge_trust P13-P15 0.3 # DMILS: some positive studies

# Physical Mechanisms
edge_trust P16-P17 0.8  # Non-Local Correlation: consistent with physics
edge_trust P17-P18 1.0  # Quantum Non-Locality: established (Bell tests)
edge_trust P17-P19 1.0  # No-Signaling: established theorem
edge_trust P16-P20 0.4  # Holographic: speculative application to psi
edge_trust P20-P21 0.4  # Bohm: philosophically rich, not testable
edge_trust P20-P22 0.8  # Holographic Principle: established physics
edge_trust P20-P23 0.3  # Pribram: limited modern support
edge_trust P16-P24 0.4  # TSVF: sound physics, speculative psi application
edge_trust P24-P25 0.4  # Time-Symmetric QM for precognition
edge_trust P24-P26 0.6  # Four Constraints: useful framework
edge_trust P16-P27 0.1  # Radiational theories: mostly falsified/unsupported
edge_trust P27-P28 0.1  # EM Carrier: shielding problems
edge_trust P27-P29 0.2  # ELF: weak correlational data
edge_trust P27-P30 0.0  # Gravity Carrier: FALSIFIED by GW170817
edge_trust P27-P31 0.1  # Tachyon: no support
edge_trust P16-P32 0.3  # Observational Theory: interesting but unfalsifiable

# Biological
edge_trust P33-P34 0.4  # Microtubules: active research area
edge_trust P34-P35 0.4  # Orch-OR: controversial, some support
edge_trust P34-P36 0.6  # Microtubule Excitation: empirical finding
edge_trust P34-P37 0.6  # Anesthetic Effects: empirical finding
edge_trust P33-P38 0.5  # Neural Correlates: some data
edge_trust P38-P39 0.5  # Unconscious Processing: plausible
edge_trust P38-P40 0.6  # Sensory Noise Reduction: ganzfeld rationale
edge_trust P33-P41 0.2  # Animal Psi: very weak evidence

# Psychological / Cognitive
edge_trust P42-P43 0.7  # Psi-Conducive Variables: well-documented
edge_trust P42-P44 0.4  # PMIR: theoretical, limited direct tests
edge_trust P42-P45 0.6  # Altered States: consistent findings

# Theoretical
edge_trust P46-P47 0.3  # Holorressonance: limited to one framework
edge_trust P46-P48 0.3  # Consciousness-Based: philosophical

# Under P3 -> section holders
edge_trust P3-P49 0.8   # Methodological Artifacts: well-documented
edge_trust P3-P55 0.8   # Cognitive Explanations: established psychology
edge_trust P3-P60 0.8   # Replication Failure: strong evidence
edge_trust P3-P63 0.7   # Neuroscience: plausible accounts

# Methodological Artifacts
edge_trust P49-P50 0.8  # Publication Bias: well-documented
edge_trust P49-P51 0.8  # Selective Reporting: well-documented
edge_trust P49-P52 0.7  # Experimenter Effect: documented
edge_trust P49-P53 0.7  # Sensory Leakage: documented in older studies
edge_trust P49-P54 0.6  # Randomization Failures: some documented

# Cognitive Explanations
edge_trust P55-P56 0.8  # Inaccurate Recall: established
edge_trust P55-P57 0.9  # Confirmation Bias: very well established
edge_trust P55-P58 0.7  # Illusion of Control: established
edge_trust P55-P59 0.8  # Reasoning Errors: established

# Replication Failure
edge_trust P60-P61 0.9  # Bem Replications: strong null results
edge_trust P60-P62 0.8  # File Drawer: well-documented concern

# Neuroscience
edge_trust P63-P64 0.6  # Temporal Lobe: some evidence
edge_trust P63-P65 0.7  # Subconscious Perception: plausible
edge_trust P63-P66 0.7  # AWARE-II: null result for visual targets

# Detail nodes under Ganzfeld
edge_trust P6-P67 0.7   # Autoganzfeld Protocol
edge_trust P6-P68 0.6   # Ganzfeld Meta-Analyses

# Detail nodes under Remote Viewing
edge_trust P7-P69 0.4   # SRI/SAIC Programs
edge_trust P7-P70 0.3   # CRV Protocol

# Detail nodes under Presentiment
edge_trust P11-P71 0.4  # Electrodermal Presentiment
edge_trust P11-P72 0.3  # fMRI/EEG Presentiment

# Detail nodes under Micro-PK
edge_trust P14-P73 0.3  # PEAR Lab
edge_trust P14-P74 0.3  # Schmidt RNG

# Detail under Quantum Non-Locality
edge_trust P18-P75 1.0  # Bell's Theorem: established
edge_trust P18-P76 1.0  # Loophole-Free Bell Tests: confirmed

# Detail under Orch-OR
edge_trust P35-P77 0.4  # Quantum Coherence in Microtubules
edge_trust P35-P78 0.3  # Gravity-Related Collapse

# Detail under Publication Bias
edge_trust P50-P79 0.8  # Funnel Plot Asymmetry

# Detail under Psi-Conducive Variables
edge_trust P43-P81 0.7  # Sheep-Goat Effect
edge_trust P43-P82 0.6  # Personality Traits
edge_trust P43-P83 0.5  # Emotional Bonding

# Detail under Altered States
edge_trust P45-P84 0.5  # Meditation
edge_trust P45-P85 0.4  # Hypnosis
edge_trust P45-P86 0.2  # Psychedelic States (very preliminary)

# Detail under Consciousness-Based
edge_trust P48-P87 0.7  # Hard Problem (established philosophy)
edge_trust P48-P88 0.3  # Panpsychism (speculative)

echo ""
echo "=== Fixing Publication Bias detail edges ==="
edge_trust P50-P79 0.8  # Funnel Plot Asymmetry
edge_trust P50-P80 0.7  # Trim-and-Fill

echo ""
echo "=== Propagating Trust ==="
$CLI $F trust propagate

echo ""
echo "=== Summary ==="
echo "References:"
$CLI $F ref list --format quiet | wc -l
echo "Trust propagation complete."
$CLI $F trust show --format table 2>/dev/null | head -20
echo "..."

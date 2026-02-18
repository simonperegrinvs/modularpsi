#!/bin/bash
# Build the psi-literature knowledge graph — Phase B, Step 4
# ~90 nodes with descriptions, keywords, categories
set -e

CLI="npx tsx src/cli/index.ts"
F="-f $HOME/data/modularpsi/psi-literature.json"
FMT="--format quiet"

add() {
  $CLI $F $FMT node add --parent "$1" --name "$2" --category "$3" --type "${4:-regular}" --description "$5" --keywords "$6"
}

echo "=== Top Level ==="
add P1 "Psi Phenomena Exist" general holder \
  "Explores hypotheses supporting the reality of anomalous cognition and interaction" \
  "psi;anomalous cognition;parapsychology"
add P1 "Psi Phenomena Do Not Exist" general holder \
  "Explores skeptical and conventional explanations for apparent psi results" \
  "skepticism;null hypothesis;conventional explanation"

echo "=== Phenomenological Evidence (under P2) ==="
add P2 "Phenomenological Evidence" phenom holder \
  "Empirical evidence from psi experiments across paradigms" \
  "evidence;experiments;effect sizes"

# ESP branch
add P4 "ESP / Extrasensory Perception" phenom holder \
  "Evidence for information transfer without known sensory channels" \
  "ESP;extrasensory;telepathy;clairvoyance"
add P5 "Ganzfeld Evidence" phenom regular \
  "Meta-analytic evidence from ganzfeld telepathy experiments; ES~0.07-0.08 in registered reports" \
  "ganzfeld;telepathy;meta-analysis;effect size"
add P5 "Remote Viewing" phenom regular \
  "Anomalous perception of distant targets; SRI/SAIC government-funded programs 1972-1995" \
  "remote viewing;SRI;SAIC;Stargate"
add P5 "Telepathic Dream Studies" phenom regular \
  "Maimonides dream laboratory studies suggesting anomalous dream content matching" \
  "dreams;Maimonides;telepathy;dream ESP"

# Precognition branch
add P4 "Precognition / Presentiment" phenom holder \
  "Evidence for anomalous foreknowledge of future events" \
  "precognition;presentiment;retrocausation"
add P9 "Bem (2011) Precognition Studies" phenom regular \
  "Nine experiments claiming precognition (d=0.22); triggered replication crisis debate in psychology" \
  "Bem;precognition;replication crisis;JPSP"
add P9 "Presentiment / Anticipatory Physiology" phenom regular \
  "Pre-stimulus physiological responses to randomly selected future stimuli; meta-analysis exists" \
  "presentiment;anticipatory;physiological;electrodermal"
add P9 "Retro-PK / Retroactive Influence" phenom regular \
  "Claimed retroactive influence on already-recorded random events" \
  "retro-PK;retroactive;time-reversed;Schmidt"

# Psychokinesis branch
add P4 "Psychokinesis (PK)" phenom holder \
  "Evidence for mental influence on physical systems" \
  "psychokinesis;PK;mind-matter;interaction"
add P13 "Micro-PK / RNG Studies" phenom regular \
  "Statistical deviations in random number generators attributed to mental intention; Bosch 2006 meta-analysis shows tiny effect with publication bias pattern" \
  "micro-PK;RNG;random number generator;PEAR"
add P13 "DMILS" phenom regular \
  "Direct Mental Interaction with Living Systems; remote physiological influence experiments" \
  "DMILS;bio-PK;remote influence;living systems"

echo "=== Physical Mechanisms (under P2) ==="
add P2 "Physical Mechanisms" phys holder \
  "Proposed physical theories that could accommodate psi phenomena" \
  "physics;mechanism;theory;quantum"

# Non-local correlation
add P16 "Non-Local Correlation Model" phys regular \
  "Psi as weak statistical bias via non-local correlations, not energy transmission" \
  "non-local;correlation;statistical;bias"
add P17 "Quantum Non-Locality" phys regular \
  "Bell test violations confirm quantum non-locality; however no-signaling theorem holds" \
  "quantum;non-locality;Bell theorem;entanglement"
add P17 "No-Signaling Constraint" phys regular \
  "Eberhard & Ross (1989): QFT prohibits faster-than-light signaling via entanglement" \
  "no-signaling;Eberhard;FTL;constraint"

# Holographic
add P16 "Holographic / Information-Theoretic" phys holder \
  "Models based on holographic principle or information-theoretic frameworks" \
  "holographic;information;Bohm;holonomic"
add P20 "Bohm Implicate Order" phys regular \
  "David Bohm's implicate/explicate order: reality as unfolded from deeper holographic level" \
  "Bohm;implicate order;explicate;wholeness"
add P20 "Holographic Principle" phys regular \
  "Bekenstein-Bousso entropy bounds; information encoded on boundary surfaces" \
  "holographic principle;Bekenstein;Bousso;entropy bound"
add P20 "Pribram Holonomic Brain Theory" phys regular \
  "Karl Pribram's model of brain function based on holographic storage in dendritic networks" \
  "Pribram;holonomic;brain;dendritic"

# TSVF
add P16 "TSVF — Two-State Vector Formalism" phys regular \
  "Aharonov's time-symmetric quantum mechanics allowing both forward and backward-evolving states" \
  "TSVF;Aharonov;time-symmetric;retrocausal"
add P24 "Time-Symmetric QM for Precognition" phys regular \
  "Application of TSVF to explain precognition via backward-evolving quantum states" \
  "time-symmetric;precognition;retrocausal;quantum"
add P24 "Four Constraints on Retrocausal Mechanisms" phys regular \
  "Necessary conditions any retrocausal model must satisfy: consistency, no grandfather paradox, thermodynamic arrow, decoherence" \
  "retrocausal;constraints;consistency;thermodynamics"

# Signal theories
add P16 "Radiational / Signal Theories" phys holder \
  "Theories proposing psi operates via some form of signal or radiation — mostly LOW trust" \
  "signal;radiation;carrier;transmission"
add P27 "EM Carrier Hypothesis" phys regular \
  "Psi via electromagnetic radiation; problematic due to attenuation and shielding experiments" \
  "electromagnetic;EM;carrier;shielding"
add P27 "ELF / Geomagnetic Correlations" phys regular \
  "Correlations between geomagnetic activity and reported psi performance" \
  "ELF;geomagnetic;Schumann;correlation"
add P27 "Gravity Carrier Hypothesis" phys regular \
  "Psi via gravitational waves — FALSIFIED by GW170817 constraining gravity speed to c" \
  "gravity;GW170817;falsified;carrier"
add P27 "Tachyon / Psitron Hypothesis" phys regular \
  "Hypothetical superluminal particles as psi carriers; no experimental support" \
  "tachyon;psitron;superluminal;speculative"

# Observational theory
add P16 "Observational Theory" phys regular \
  "Schmidt/Walker model: consciousness collapses quantum states, explaining PK and precognition" \
  "observational theory;Schmidt;Walker;collapse"

echo "=== Biological / Physiological (under P2) ==="
add P2 "Biological / Physiological Correlates" bio holder \
  "Biological mechanisms that might support or correlate with psi functioning" \
  "biology;physiology;neural;quantum biology"

# Microtubules
add P33 "Microtubules / Quantum Biology" bio holder \
  "Quantum processes in microtubules as possible substrate for consciousness and psi" \
  "microtubules;quantum biology;tubulin;coherence"
add P34 "Orch-OR (Penrose-Hameroff)" bio regular \
  "Orchestrated Objective Reduction: consciousness from quantum gravity effects in microtubules" \
  "Orch-OR;Penrose;Hameroff;objective reduction"
add P34 "Microtubule Excitation Migration" bio regular \
  "Kalra et al. (2022/2023): electronic excitation can propagate along microtubules" \
  "Kalra;excitation;migration;microtubule"
add P34 "Anesthetic Effects on Microtubules" bio regular \
  "Khan et al. (2024): Epothilone B delays anesthetic-induced unconsciousness, supporting microtubule role" \
  "anesthetic;Khan;Epothilone;microtubule"

# Neural correlates
add P33 "Neural Correlates of Psi" bio holder \
  "Neural and physiological processes associated with psi performance" \
  "neural;correlates;EEG;fMRI"
add P38 "Unconscious Processing in Psi" bio regular \
  "Evidence that psi information is processed below conscious awareness" \
  "unconscious;subliminal;implicit;processing"
add P38 "Sensory Noise Reduction" bio regular \
  "Ganzfeld rationale: reducing sensory noise allows weak psi signals to reach awareness" \
  "sensory noise;ganzfeld;signal-to-noise;reduction"

# Animal psi
add P33 "Evolutionary Psi / Animal Psi" bio regular \
  "Claims of psi abilities in animals; evolutionary arguments for psi as adaptive trait" \
  "animal psi;evolution;adaptive;Sheldrake"

echo "=== Psychological / Cognitive (under P2) ==="
add P2 "Psychological / Cognitive Factors" psych holder \
  "Psychological variables that moderate or correlate with psi performance" \
  "psychology;cognitive;personality;belief"

add P42 "Psi-Conducive Variables" psych regular \
  "Belief, openness to experience, extraversion, and emotional bonding as psi moderators" \
  "belief;openness;extraversion;sheep-goat"
add P42 "PMIR — Psi-Mediated Instrumental Response" psych regular \
  "Stanford's model: psi as an unconscious process serving organism's needs" \
  "PMIR;Stanford;instrumental;unconscious"
add P42 "Altered States and Psi" psych regular \
  "Enhanced psi performance in altered states: meditation, hypnosis, ganzfeld, dreaming" \
  "altered states;meditation;hypnosis;dreaming"

echo "=== Theoretical Frameworks (under P2) ==="
add P2 "Theoretical Frameworks" theory holder \
  "Overarching integrative theories attempting to explain psi phenomena" \
  "theory;framework;integrative;model"

add P46 "Holorressonance Model (Stern)" theory regular \
  "Stern's model integrating holographic brain theory with resonance for psi explanation" \
  "holorressonance;Stern;holographic;resonance"
add P46 "Consciousness-Based Frameworks" theory regular \
  "Theories grounding psi in fundamental properties of consciousness" \
  "consciousness;fundamental;panpsychism;idealism"

echo "=== Methodological Artifacts (under P3) ==="
add P3 "Methodological Artifacts" method holder \
  "Methodological problems that could produce false-positive psi results" \
  "methodology;artifacts;bias;error"

add P49 "Publication Bias / Funnel Plot Asymmetry" method regular \
  "Systematic non-publication of null results inflating apparent effect sizes" \
  "publication bias;funnel plot;file drawer;selection"
add P49 "Selective Reporting / p-hacking" method regular \
  "Flexible analysis choices and outcome switching producing spurious significance" \
  "p-hacking;selective reporting;HARKing;flexibility"
add P49 "Experimenter Effect / Demand Characteristics" method regular \
  "Experimenters unconsciously influencing results; participants responding to expectations" \
  "experimenter effect;demand;expectation;Rosenthal"
add P49 "Sensory Leakage" method regular \
  "Unintended sensory cues providing information attributed to psi" \
  "sensory leakage;cues;artifacts;blinding"
add P49 "Randomization Failures" method regular \
  "Defective random number generation or predictable target sequences" \
  "randomization;RNG;pseudo-random;sequence"

echo "=== Cognitive Explanations (under P3) ==="
add P3 "Cognitive Explanations" skeptic holder \
  "Normal cognitive processes that produce subjective impressions of psi" \
  "cognitive;bias;illusion;perception"

add P55 "Inaccurate Recall / Memory Distortion" skeptic regular \
  "Distorted memory creating false impressions of precognition or telepathy" \
  "memory;recall;distortion;false memory"
add P55 "Confirmation Bias / Illusory Correlation" skeptic regular \
  "Selectively noticing hits while ignoring misses in apparent psi experiences" \
  "confirmation bias;illusory correlation;selective attention"
add P55 "Illusion of Control" skeptic regular \
  "Overestimating personal influence on random outcomes" \
  "illusion of control;Langer;randomness;overestimate"
add P55 "Reasoning Errors" skeptic regular \
  "Base rate neglect, conjunction fallacy, and other probabilistic reasoning failures" \
  "reasoning;base rate;conjunction fallacy;probability"

echo "=== Replication Failure Evidence (under P3) ==="
add P3 "Replication Failure Evidence" method holder \
  "Documented failures to replicate key psi findings" \
  "replication;failure;null results;decline"

add P60 "Bem Replication Failures" method regular \
  "Galak et al. (2012): large multi-lab replication of Bem yielded d=0.04 (null)" \
  "Bem;replication;Galak;null result"
add P60 "File Drawer Problem / Optional Stopping" method regular \
  "Unknown number of unreported null studies; flexible stopping rules" \
  "file drawer;optional stopping;Rosenthal;unreported"

echo "=== Neuroscience of Anomalous Experience (under P3) ==="
add P3 "Neuroscience of Anomalous Experience" consc holder \
  "Neuroscientific explanations for experiences interpreted as psi" \
  "neuroscience;anomalous experience;brain;neural"

add P63 "Temporal Lobe / Psychosis Hypothesis" consc regular \
  "Temporal lobe activity and psychosis-spectrum traits associated with paranormal experiences" \
  "temporal lobe;psychosis;Persinger;epilepsy"
add P63 "Subconscious Perception" consc regular \
  "Subtle sensory processing below conscious awareness misattributed to psi" \
  "subconscious;subliminal;implicit perception;priming"
add P63 "AWARE-II NDE Results" consc regular \
  "Parnia et al. (2023): no visual target confirmed in near-death experience study" \
  "AWARE;NDE;Parnia;near-death;visual target"

echo "=== Additional Detail Nodes ==="

# Ganzfeld sub-detail
add P6 "Autoganzfeld Protocol" phenom regular \
  "Computerized ganzfeld protocol eliminating sensory leakage; established by Honorton" \
  "autoganzfeld;Honorton;automated;protocol"
add P6 "Ganzfeld Meta-Analyses" phenom regular \
  "Multiple meta-analyses of ganzfeld data (Honorton 1985, Storm 2010, Tressoldi 2024)" \
  "meta-analysis;ganzfeld;Storm;Tressoldi"

# Remote Viewing sub-detail
add P7 "SRI/SAIC Programs" phenom regular \
  "Government-funded remote viewing research at Stanford Research Institute and SAIC (1972-1995)" \
  "SRI;SAIC;Stargate;government;Targ;Puthoff"
add P7 "Coordinate Remote Viewing Protocol" phenom regular \
  "Structured protocol for remote viewing using geographic coordinates" \
  "coordinate;CRV;protocol;structured"

# Presentiment sub-detail
add P11 "Electrodermal Presentiment" phenom regular \
  "Skin conductance changes preceding randomly selected emotional vs. calm stimuli" \
  "electrodermal;skin conductance;Radin;autonomic"
add P11 "fMRI/EEG Presentiment Studies" phenom regular \
  "Brain imaging studies of pre-stimulus neural activity" \
  "fMRI;EEG;brain imaging;pre-stimulus"

# Micro-PK sub-detail
add P14 "Princeton PEAR Lab" phenom regular \
  "Princeton Engineering Anomalies Research: 28 years of RNG-PK experiments" \
  "PEAR;Princeton;Jahn;Dunne;anomalies"
add P14 "Schmidt RNG Experiments" phenom regular \
  "Helmut Schmidt's foundational RNG experiments and pre-recorded target designs" \
  "Schmidt;RNG;pre-recorded;quantum"

# Quantum non-locality sub-detail
add P18 "Bell's Theorem" found regular \
  "No local hidden variable theory can reproduce all predictions of quantum mechanics" \
  "Bell;theorem;hidden variables;inequality"
add P18 "Loophole-Free Bell Tests" found regular \
  "Hensen et al. (2015) and others closing locality, detection, freedom-of-choice loopholes" \
  "loophole-free;Hensen;Delft;detection;locality"

# Orch-OR sub-detail
add P35 "Quantum Coherence in Microtubules" bio regular \
  "Evidence for and against quantum coherent processes in biological microtubules" \
  "quantum coherence;decoherence;warm;biological"
add P35 "Gravity-Related Collapse Hypothesis" bio regular \
  "Penrose's proposal that gravity causes quantum state reduction; Donadi et al. (2021) constrains" \
  "gravity collapse;Penrose;Donadi;objective reduction"

# Publication Bias sub-detail
add P50 "Funnel Plot Asymmetry Analysis" method regular \
  "Visual and statistical tests for publication bias in psi meta-analyses" \
  "funnel plot;Egger;asymmetry;trim-and-fill"
add P50 "Trim-and-Fill Corrections" method regular \
  "Statistical method estimating and correcting for missing null studies" \
  "trim-and-fill;Duval;Tweedie;correction"

# Psi-conducive variables sub-detail
add P43 "Belief in Psi (Sheep-Goat Effect)" psych regular \
  "Believers (sheep) consistently score higher than disbelievers (goats) in psi experiments" \
  "sheep-goat;belief;Schmeidler;expectation"
add P43 "Personality Traits and Psi" psych regular \
  "Correlations between Big Five traits (especially openness, extraversion) and psi scoring" \
  "personality;Big Five;openness;extraversion"
add P43 "Emotional Bonding and Psi" psych regular \
  "Stronger psi effects between emotionally connected sender-receiver pairs" \
  "emotional bonding;sender-receiver;rapport;relationship"

# Altered states sub-detail
add P45 "Meditation and Psi" psych regular \
  "Enhanced psi performance in experienced meditators and during meditation" \
  "meditation;mindfulness;contemplative;psi performance"
add P45 "Hypnosis and Psi" psych regular \
  "Hypnotic induction as psi-conducive state; mixed evidence" \
  "hypnosis;suggestibility;trance;induction"
add P45 "Psychedelic States and Psi" psych regular \
  "Anecdotal and preliminary research on psychedelics and anomalous experiences" \
  "psychedelic;psilocybin;ayahuasca;altered state"

# Consciousness frameworks sub-detail
add P48 "Hard Problem of Consciousness" consc regular \
  "Chalmers' hard problem: why is there subjective experience? Implications for psi theories" \
  "hard problem;Chalmers;qualia;subjective experience"
add P48 "Panpsychism and Psi" theory regular \
  "If consciousness is fundamental, psi may be a natural consequence of mind-matter interaction" \
  "panpsychism;fundamental;consciousness;Tononi"

echo ""
echo "=== Node hierarchy complete ==="
$CLI $F node list --format quiet | wc -l
echo "nodes created"

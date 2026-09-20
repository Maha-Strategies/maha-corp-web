/**
 * Physical AI: how learned systems act in the physical world, and what their
 * results establish.
 *
 * This section is the learning, modelling and evaluation-of-models companion
 * to /knowledge/robotics. Robotics owns the hardware, the evidence intake and
 * the safety boundaries; those pages are linked rather than restated. Where a
 * subject exists in both, robotics owns the evidence record and this section
 * owns the model behaviour that produces it.
 *
 * Maha builds no robots and runs no physical experiments. Every claim about a
 * published system is attributed to a paper that was opened and read at the
 * locator recorded below; the evaluation method around it is Maha's own.
 */

export const PHYSICAL_AI_PATH = '/knowledge/physical-ai'
export const PHYSICAL_AI_RELEASE_DATE = '2026-09-19'
export const PHYSICAL_AI_VERSION = 'physical-ai-knowledge/0.1'

export type PhysicalAiSource = {
  title: string
  url: string
  locator: string
  inspected: string
  /**
   * A short verbatim phrase from the cited passage. It is the verification
   * handle: a reviewer can search the source for this string and see whether
   * the passage says what the claim says it says. Tests can check that an
   * anchor is present and short; only a person re-reading the source can
   * confirm it is there.
   */
  anchor: string
  claim: string
  boundary: string
  rights: string
}

export const PHYSICAL_AI_SOURCES = {
  imitation: {
    title: 'Ross, Gordon and Bagnell — A Reduction of Imitation Learning and Structured Prediction to No-Regret Online Learning (DAgger)',
    url: 'https://arxiv.org/abs/1011.0686',
    locator: 'Abstract; §1 Introduction',
    inspected: '2026-09-19',
    anchor: 'good performance under the distribution of observations it induces',
    claim: 'A policy trained on an expert’s demonstrations encounters, at execution time, the distribution of observations that its own actions induce; the paper’s iterative approach targets good performance under that induced distribution rather than under the expert’s.',
    boundary: 'A learning-theoretic result with its own assumptions and benchmark experiments. It does not establish that any particular robot policy is safe, nor how much data a given task needs.',
    rights: 'Original paraphrase and link to the open preprint; no figures, tables or text reproduced.',
  },
  randomization: {
    title: 'Tobin et al. — Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World',
    url: 'https://arxiv.org/abs/1703.06907',
    locator: '§III-A Domain randomization',
    inspected: '2026-09-19',
    anchor: 'position, orientation, and field of view of the camera',
    claim: 'The method randomises stated aspects of the simulated scene during training — number and shape of distractor objects, object positions and textures, table, floor, skybox and robot textures, camera position, orientation and field of view, lighting, and image noise — so that the real world appears to the model as one more variation.',
    boundary: 'The paper demonstrates transfer for its own task and setup, with a fixed table height and an uncalibrated monocular camera. Randomising a list of parameters is not evidence that any other task transfers.',
    rights: 'Original paraphrase and link to the open preprint.',
  },
  worldmodel: {
    title: 'Ha and Schmidhuber — World Models',
    url: 'https://arxiv.org/abs/1803.10122',
    locator: '§4.4 Transfer policy to actual environment; surrounding discussion of model imperfections',
    inspected: '2026-09-19',
    anchor: 'the tradeoff between realism and exploitability',
    claim: 'A controller can be trained inside a learned generative model of an environment and then transferred back; the authors discuss how an agent can exploit imperfections of that learned model, and use a temperature parameter to make the imagined environment harder to exploit.',
    boundary: 'The environments are video games. Nothing in the paper concerns physical contact, hardware safety, or a robot acting among people.',
    rights: 'Original paraphrase and link to the open preprint.',
  },
  vla: {
    title: 'Kim et al. — OpenVLA: An Open-Source Vision-Language-Action Model',
    url: 'https://arxiv.org/abs/2406.09246',
    locator: 'Abstract; §1 Introduction',
    inspected: '2026-09-19',
    anchor: 'outperforming closed models such as RT-2-X (55B) by 16.5%',
    claim: 'A vision-language-action model couples a pretrained vision-language backbone to robot action outputs; OpenVLA is a 7B-parameter open model trained on 970k real robot demonstrations, reported by its authors to exceed a 55B closed model by 16.5 percentage points of absolute task success across 29 tasks and several embodiments.',
    boundary: 'Those are the authors’ own reported results on their evaluation suites and embodiments. They are not an independent replication, and success rates on 29 tasks do not describe behaviour in an unseen setting.',
    rights: 'Original paraphrase and link to the open preprint; reported figures attributed to the authors.',
  },
  uncertainty: {
    title: 'Lakshminarayanan, Pritzel and Blundell — Simple and Scalable Predictive Uncertainty Estimation using Deep Ensembles',
    url: 'https://arxiv.org/abs/1612.01474',
    locator: 'Abstract; §1 Introduction',
    inspected: '2026-09-19',
    anchor: 'express higher uncertainty on out-of-distribution examples',
    claim: 'The authors report that an ensemble of independently trained networks produces uncertainty estimates competitive with approximate Bayesian methods, and expresses higher uncertainty on out-of-distribution test examples.',
    boundary: 'Classification and regression benchmarks, not robot control. Higher uncertainty on out-of-distribution inputs is a reported tendency, not a detector with a guaranteed operating point.',
    rights: 'Original paraphrase and link to the open preprint.',
  },
  benchmark: {
    title: 'Yu et al. — Meta-World: A Benchmark and Evaluation for Multi-Task and Meta Reinforcement Learning',
    url: 'https://arxiv.org/abs/1910.10897',
    locator: 'Abstract; §1 Introduction',
    inspected: '2026-09-19',
    anchor: 'even with as few as ten distinct training tasks',
    claim: 'The benchmark provides 50 distinct simulated manipulation tasks; the authors report that while individual tasks and their variations can be learned, the algorithms they evaluated struggled to learn several tasks at once, even with as few as ten training tasks.',
    boundary: 'Simulated manipulation with the benchmark’s own object models and reward structure. A score here is not a statement about a physical robot.',
    rights: 'Original paraphrase and link to the open preprint.',
  },
  risk: {
    title: 'NIST AI Risk Management Framework',
    url: 'https://www.nist.gov/itl/ai-risk-management-framework',
    locator: 'Overview of the AI RMF — the framework’s own purpose statement',
    inspected: '2026-09-20',
    anchor: 'intended for voluntary use',
    claim: 'NIST states that the AI Risk Management Framework is intended for voluntary use and to improve the ability to incorporate trustworthiness considerations into the design, development, use and evaluation of AI products, services and systems.',
    boundary: 'Voluntary guidance, and following it certifies nothing. The framework is general-purpose rather than prescriptive for a domain: NIST has issued companion profiles for other sectors, but there is no robot-specific profile and no acceptance criterion for a physical machine anywhere in it.',
    rights: 'Original paraphrase and link only.',
  },
  estimation: {
    title: 'Welch and Bishop — An Introduction to the Kalman Filter (UNC-Chapel Hill TR 95-041)',
    url: 'https://www.cs.utexas.edu/~pstone/Courses/393Rfall15/readings/Welch+Bishop-TR-95.pdf',
    locator: '§1 The Discrete Kalman Filter — “The Computational Origins of the Filter” and the discussion of equation (1.8); the time-update / measurement-update cycle',
    inspected: '2026-09-20',
    anchor: 'the gain K weights the residual more heavily',
    claim: 'The filter alternates a time update that projects the state forward to produce an a priori estimate with a measurement update that corrects it into an a posteriori estimate, weighting the two by a gain computed from the process-noise covariance Q and the measurement-noise covariance R. The document states that as R approaches zero the gain weights the residual more heavily, with the limit of the gain equal to the inverse of the measurement matrix, and that as the a priori error covariance approaches zero the gain weights the residual less heavily, with the limit equal to zero — equivalently, the measurement is trusted more as R falls and less as the prediction becomes confident.',
    boundary: 'A tutorial on a linear estimator under assumed Gaussian noise with known Q and R. It does not tell you the real noise of any sensor, does not cover the nonlinear or non-Gaussian case beyond an introduction, and offers no guarantee about a robot that uses it.',
    rights: 'Paraphrase and link to the publicly posted technical report; equations and text not reproduced.',
  },
  rewardhacking: {
    title: 'Amodei, Olah, Steinhardt, Christiano, Schulman and Mané — Concrete Problems in AI Safety',
    url: 'https://arxiv.org/abs/1606.06565',
    locator: 'Abstract; §3 Avoiding Negative Side Effects; §4 Avoiding Reward Hacking',
    inspected: '2026-09-20',
    anchor: 'the robot may think the office is clean if it simply closes its eyes',
    claim: 'The paper frames accidents as unintended and harmful behaviour arising from poor design, and separates five problems, two of which come from having the wrong objective function: negative side effects and reward hacking. Its running cleaning-robot example illustrates both — an agent rewarded for moving a box may knock over a vase in its path because the objective expresses indifference to everything it does not mention, and an agent rewarded for how few messes it sees can satisfy that objective by closing its eyes. It further describes reward hacking through Goodhart’s law (rewarding a correlate such as bleach consumption invites overuse), feedback loops, and wireheading, where an agent tampers with the sensor that reports its score.',
    boundary: 'A research agenda that names failure modes and proposes directions. It is not a result about any deployed system, provides no detector for these failures, and does not establish how often they occur in practice.',
    rights: 'Paraphrase and link to the open preprint; short attributed wording only.',
  },
  rt2: {
    title: 'Brohan et al. — RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control',
    url: 'https://arxiv.org/abs/2307.15818',
    locator: 'Abstract; §1 Introduction',
    inspected: '2026-09-20',
    anchor: '6k evaluation trials',
    claim: 'The authors express robot actions as text tokens and co-fine-tune a pretrained vision-language model on robot trajectory data together with internet-scale vision-language tasks such as visual question answering. They report improved generalisation to novel objects, the ability to follow commands absent from the robot training data, and rudimentary reasoning such as selecting the smallest or largest object or identifying a suitable implement, evaluated over some 6,000 trials.',
    boundary: 'The authors’ own reported results on their own robots and evaluation set. The abstract gives capabilities rather than a headline success-rate figure, no independent replication is cited, and emergent behaviour on chosen probes is not a guarantee of behaviour elsewhere.',
    rights: 'Paraphrase and link to the open preprint; no figures or tables reproduced.',
  },
  teleoperation: {
    title: 'Zhao, Kumar, Levine and Finn — Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware (ALOHA / ACT)',
    url: 'https://arxiv.org/abs/2304.13705',
    locator: 'Abstract; project description of the teleoperation setup',
    inspected: '2026-09-20',
    anchor: '80-90% success',
    claim: 'The authors describe a low-cost bimanual teleoperation setup used to collect human demonstrations, and Action Chunking with Transformers, an algorithm that learns a generative model over action sequences rather than single actions, motivated by compounding policy error and non-stationary human demonstration. They report learning six fine manipulation tasks — including opening a translucent condiment cup and slotting a battery — at 80–90% success from around ten minutes of demonstrations in total.',
    boundary: 'The authors’ own reported results on their own hardware and task set. Ten minutes of demonstration sufficing for six chosen tasks is not a general data requirement, and no safety, durability or unattended-operation claim follows from it.',
    rights: 'Paraphrase and link to the open preprint; no figures or tables reproduced.',
  },
} as const

export type PhysicalAiSourceId = keyof typeof PHYSICAL_AI_SOURCES

export type PhysicalAiArticle = {
  slug: string
  title: string
  answer: string
  explanation: string
  example: string
  establishes: string
  boundary: string
  checks: string[]
  sources: PhysicalAiSourceId[]
  related: string[]
  crossLinks?: { path: string; label: string }[]
}

export const PHYSICAL_AI_ARTICLES: PhysicalAiArticle[] = [
  {
    slug: 'what-physical-ai-means',
    title: 'What “physical AI” means, and how it relates to robotics and control',
    answer:
      'Physical AI is the use of learned models to perceive and act in the physical world under real time, real sensors and real consequences. It is a perspective on robotics, not a replacement for it, and it inherits everything control engineering already knows about feedback.',
    explanation:
      'Three fields meet here. Control theory contributes stability, feedback and the idea that the world is observed through imperfect sensors. Robotics contributes the hardware, the task and the safety envelope. Machine learning contributes models that are fitted to data rather than derived from equations. The term “embodied AI” usually emphasises that an agent’s inputs depend on its own past actions; “physical AI” is used commercially for the same loop when it runs on hardware. Maha uses the term for the learning-and-modelling perspective, and keeps hardware evidence, safety and intake records in the robotics section, where they already live.',
    example:
      'A learned policy that outputs gripper velocities is a controller whose gains were fitted rather than tuned. Everything a control engineer would ask — what is the loop delay, what happens if a measurement drops out, what does it do at the edge of its operating envelope — still applies, and is usually easier to answer for the tuned version.',
    establishes:
      'Nothing empirical. This page defines terms and draws the boundary between this section and the robotics section.',
    boundary:
      'A vocabulary page. It does not endorse any architecture, and “physical AI” is not a technical standard or a capability claim.',
    checks: [
      'When you read the term, ask which part is learned: perception, the policy, the model of the world, or the whole loop.',
      'Ask what would happen if the learned component were replaced by a hand-designed one; if nobody has tried, the comparison is missing.',
      'Keep the hardware question separate from the model question.',
    ],
    sources: [],
    related: ['perception-action-loops', 'planning-and-feedback-control', 'vision-language-action-models'],
    crossLinks: [
      { path: '/knowledge/robotics', label: 'Robotics: hardware, evidence intake and safety boundaries' },
      { path: '/knowledge/robotics/embodiment-and-capability', label: 'Why an embodiment is not a capability claim' },
    ],
  },
  {
    slug: 'perception-action-loops',
    title: 'The loop is the system: perception, state, action, consequence',
    answer:
      'A physical AI system is a loop, not a pipeline. Its own actions change what it will observe next, which is why accuracy measured on a fixed dataset does not predict behaviour when the policy is driving.',
    explanation:
      'Offline, a perception model sees a dataset someone else collected. Online, it sees the consequences of its own choices: a slightly wrong grasp moves the object, the next image is one that no dataset contained, and the error compounds. Ross and colleagues made exactly this point for imitation learning, targeting performance under the distribution of observations the learned policy induces rather than the expert’s. The same structure governs latency: a decision computed from a 150 ms-old observation is applied to a world that has moved, so the effective loop delay belongs in the system description alongside the model’s accuracy.',
    example:
      'The runnable fixture in this section makes this visible. A tracker with small per-step error and a two-step actuation delay drifts steadily away from its target, while the same tracker with zero delay converges — same perception quality, different closed-loop outcome.',
    establishes:
      'That the induced-distribution problem is a recognised property of policies trained on someone else’s trajectories, stated as such in the imitation-learning literature.',
    boundary:
      'Recognising the problem does not quantify it for a given system. The fixture is a simulation and says nothing about any real robot’s stability.',
    checks: [
      'Ask whether the reported accuracy came from a held-out dataset or from running the policy in the loop.',
      'Ask for the end-to-end latency from exposure to actuation, not the inference time alone.',
      'Ask what the system does when an observation is late or missing.',
    ],
    sources: ['imitation'],
    related: ['learning-from-demonstration', 'uncertainty-and-distribution-shift', 'evaluation-fixture-example'],
    crossLinks: [
      { path: '/knowledge/robotics/sensor-time-alignment', label: 'Robotics: timestamps and alignment in the recorded evidence' },
    ],
  },
  {
    slug: 'world-models',
    title: 'World models, and what an agent does with an imperfect one',
    answer:
      'A world model is a learned predictor of what happens next. Training a controller inside one is efficient and introduces a specific failure: the controller can learn to exploit the model’s mistakes instead of solving the task.',
    explanation:
      'Ha and Schmidhuber trained a controller entirely inside a learned generative model of a game environment and transferred it back to the real environment. Their discussion is the useful part for a practitioner: an agent optimising against a learned model will find the places where the model is wrong, because those are the cheapest sources of reward. Their mitigation was to make the imagined environment harder to exploit by raising the uncertainty of the model’s own rollouts. For physical systems the exploitable errors tend to be exactly the phenomena that are hardest to model — contact, friction, deformation — which is why a policy that performs beautifully in imagination can fail on contact.',
    example:
      'A model that under-predicts friction lets an imagined gripper slide an object into place with a light touch. The policy learns the light touch. On hardware the object does not slide, and the same policy stalls against it.',
    establishes:
      'That training inside a learned model and transferring outward is a demonstrated technique in game environments, and that exploitation of model error is a described failure mode rather than a hypothetical one.',
    boundary:
      'The published demonstration concerns video games. It is not evidence about physical contact, hardware safety, or people sharing a workspace with a machine.',
    checks: [
      'Ask which phenomena the world model was fitted on, and which it was never shown.',
      'Ask whether performance inside the model and on the real system were reported side by side.',
      'Look for the failure cases where the two disagree; that gap is where the model is wrong.',
    ],
    sources: ['worldmodel'],
    related: ['simulation-and-domain-randomization', 'uncertainty-and-distribution-shift'],
    crossLinks: [
      { path: '/knowledge/robotics/simulation-to-hardware', label: 'Robotics: what a simulated result may claim about hardware' },
    ],
  },
  {
    slug: 'vision-language-action-models',
    title: 'Vision-language-action models: what the success rate means',
    answer:
      'A vision-language-action model maps images and an instruction directly to robot actions, using a pretrained vision-language backbone. Reported success rates describe the tasks, objects and embodiments that were evaluated, and generalise no further on their own.',
    explanation:
      'OpenVLA is a 7B-parameter open model trained on 970k real robot demonstrations, which its authors report outperforming a much larger closed model by 16.5 percentage points of absolute success across 29 tasks and multiple embodiments. Two things follow. First, the recipe is real: internet-scale vision-language pretraining plus robot demonstrations produces policies that follow language instructions across objects better than task-specific training. Second, every number of that kind is an average over a named task set, scored by a rule the authors chose, on hardware they controlled. Reading “generalist” as “works in my setting” is the error that a procurement decision cannot afford.',
    example:
      'A model reported at 60% success on a 29-task suite may be near 100% on the pick-and-place subsets and near zero on anything requiring force control. A per-task table answers that; a headline average does not.',
    establishes:
      'That the architecture and the authors’ reported comparisons exist as published. It does not establish any figure independently.',
    boundary:
      'Self-reported results from the authors’ own suite, not an independent replication. Success rate says nothing about failure severity, recovery behaviour or safety.',
    checks: [
      'Ask for per-task results and the definition of success used for each.',
      'Ask which embodiment and which cameras produced the numbers, and how they differ from yours.',
      'Ask what happens on failure: does the policy stop, retry, or continue into contact?',
    ],
    sources: ['vla'],
    related: ['learning-from-demonstration', 'benchmark-validity', 'runtime-monitoring-and-fallback'],
    crossLinks: [
      { path: '/knowledge/robotics/manipulation-evidence', label: 'Robotics: what a pick-and-place result demonstrates' },
    ],
  },
  {
    slug: 'learning-from-demonstration',
    title: 'Learning from demonstration and teleoperation',
    answer:
      'Cloning an expert’s actions is the most direct way to get a policy. Its characteristic failure is that the learner must act in states the expert never visited, and small errors take it there.',
    explanation:
      'Behaviour cloning fits a mapping from observation to action on demonstrated trajectories. Because the learned policy then generates its own trajectory, it encounters its own induced distribution of observations — the problem Ross and colleagues address by collecting corrective labels in the states the learner actually reaches. For teleoperated data collection, the practical consequences are concrete: an operator’s recovery behaviour is training signal, not noise, and demonstrations collected only by an expert who never makes mistakes leave the policy with no example of recovery. Who operated, on which interface, with what latency, becomes part of the dataset description.',
    example:
      'Demonstrations recorded with a smooth, low-latency haptic rig transfer poorly to a policy deployed with a laggy interface: the operator was compensating for dynamics that the deployed system does not have, and the policy learned the compensation.',
    establishes:
      'That the distribution mismatch between demonstrated and self-induced states is a stated problem in the imitation-learning literature, with an established family of corrective approaches.',
    boundary:
      'Nothing here establishes how many demonstrations any task needs, or that corrective data collection is safe to perform on a given system.',
    checks: [
      'Ask how many operators produced the data and how their interfaces differed.',
      'Ask whether recoveries and failures were kept in the dataset or filtered out.',
      'Ask whether any corrective data was collected in states the policy itself reached.',
    ],
    sources: ['imitation', 'vla'],
    related: ['perception-action-loops', 'data-provenance-and-permissions', 'vision-language-action-models'],
    crossLinks: [
      { path: '/knowledge/robotics/dataset-leakage', label: 'Robotics: keeping training exposure out of evaluation claims' },
    ],
  },
  {
    slug: 'simulation-and-domain-randomization',
    title: 'Domain randomization: what it varies, and what transfer it buys',
    answer:
      'Domain randomization trains a model across randomly varied simulated conditions so that reality looks like one more variation. It buys robustness to the parameters that were randomized, and nothing about the ones that were not.',
    explanation:
      'Tobin and colleagues randomized a specific list during training: the number and shape of distractor objects, the positions and textures of objects, the textures of table, floor, skybox and robot, the camera’s position, orientation and field of view, the number and properties of lights, and image noise. That list is the claim. Anything held fixed in simulation is a property the model may silently depend on — in their setup, table height was fixed, and the estimate was a planar one from an uncalibrated monocular camera. When someone says a policy was trained with domain randomization, the informative question is always which parameters, over what ranges.',
    example:
      'A grasping policy randomized over textures and lighting still fails on a transparent object, because the rendering never produced refraction. The randomization list did not include the physics that the real object exhibits.',
    establishes:
      'That the technique and its randomized parameter list are published, and that transfer was demonstrated for the paper’s own task.',
    boundary:
      'One task, one setup, one set of ranges. It is not evidence that randomization transfers a different task, and simulated success remains simulated.',
    checks: [
      'Ask for the randomized parameter list and its ranges, not the phrase.',
      'Ask which physical phenomena the simulator does not model at all.',
      'Ask whether real-world evaluation used objects and lighting outside the randomized ranges.',
    ],
    sources: ['randomization', 'worldmodel'],
    related: ['world-models', 'benchmark-validity'],
    crossLinks: [
      { path: '/knowledge/robotics/simulation-to-hardware', label: 'Robotics: moving a claim from simulation to hardware' },
    ],
  },
  {
    slug: 'planning-and-feedback-control',
    title: 'Planning and feedback control do different jobs',
    answer:
      'A planner chooses what to do over a horizon; a feedback controller keeps the system on that choice despite disturbance. Learned policies can replace either, and confusing which one was replaced makes a result unreadable.',
    explanation:
      'Planning reasons about goals, sequencing and feasibility, usually at tens or hundreds of milliseconds. Feedback runs far faster, with the job of rejecting disturbance and keeping contact forces and trajectories bounded. An end-to-end learned policy may be doing both, and that is where its evaluation gets difficult: a failure could be a bad plan, a bad correction, or a plan the controller could not execute. Maha’s proposal is to state, before evaluating, which layer the learned component replaces and which layer remains hand-designed, so failures can be attributed rather than argued.',
    example:
      'A policy that pauses mid-reach when an object shifts may be re-planning, or may have saturated a velocity limit. Logging the commanded and achieved velocities separates those two explanations; a success-rate table does not.',
    establishes:
      'Nothing empirical. This is a decomposition Maha proposes for reading results, consistent with ordinary control practice.',
    boundary:
      'Not a control-design guide, and no stability property is asserted for any learned controller.',
    checks: [
      'Ask which layer is learned and which is classical, including any safety filter.',
      'Ask at what rate each layer runs and what happens when the slower one is late.',
      'Ask whether commanded and achieved quantities are logged separately.',
    ],
    sources: [],
    related: ['perception-action-loops', 'runtime-monitoring-and-fallback'],
    crossLinks: [
      { path: '/knowledge/robotics/planning-control-and-authority', label: 'Robotics: who or what holds authority over an action' },
    ],
  },
  {
    slug: 'uncertainty-and-distribution-shift',
    title: 'Uncertainty estimates and the inputs a model has never seen',
    answer:
      'A useful uncertainty estimate rises when the input is unlike training data. Reported methods do this on average; none of them is a guaranteed detector, and an average is not an operating point.',
    explanation:
      'Deep ensembles — several independently trained networks whose predictions are combined — were reported by Lakshminarayanan and colleagues to give uncertainty estimates competitive with approximate Bayesian approaches, and to express higher uncertainty on out-of-distribution examples. For a physical system the question is what that buys operationally. An uncertainty signal is only useful if something acts on it: slow down, request assistance, refuse the action. That requires a threshold, and a threshold requires knowing the false-alarm and missed-detection rates at the chosen operating point on data like the deployment, which a benchmark average does not give you.',
    example:
      'An ensemble flags a novel object with high variance in 80% of cases. If the remaining 20% includes the case that causes contact, the monitor does not remove the need for the fallback behaviour; it only reduces how often the fallback is needed.',
    establishes:
      'That ensembles are a published, scalable approach reported to express higher uncertainty out of distribution on classification and regression benchmarks.',
    boundary:
      'Benchmarks, not robots. No detection guarantee, no operating point, and no claim that an uncertain prediction is a safe one.',
    checks: [
      'Ask what action the uncertainty signal triggers, and at what threshold.',
      'Ask for the false-alarm and missed-detection rates at that threshold on representative data.',
      'Ask what happens when the monitor itself is out of distribution.',
    ],
    sources: ['uncertainty'],
    related: ['runtime-monitoring-and-fallback', 'perception-action-loops', 'world-models'],
  },
  {
    slug: 'runtime-monitoring-and-fallback',
    title: 'Runtime monitoring, intervention and what the system does when it is wrong',
    answer:
      'Behaviour on failure is a design choice that should be specified before deployment: what is monitored, what threshold triggers, what the system does next, and who can intervene.',
    explanation:
      'NIST publishes its AI Risk Management Framework for voluntary use across design, development, use and evaluation, which is the right altitude for this: it prompts the questions without deciding them. A monitor is only meaningful together with a fallback — stop, hold position, hand back to an operator, retry with reduced speed — and with an intervention path that someone can actually reach in time. Maha’s proposal is to write the monitor, the threshold, the fallback and the intervention route into the evaluation contract, and then to report how often each fired, including false alarms, because a monitor nobody trusts gets switched off.',
    example:
      'A force threshold that halts on contact will also halt on a normal insertion. If the recorded evaluation does not separate “halted on a real anomaly” from “halted on an ordinary contact”, the operator’s experience of nuisance stops is invisible in the result.',
    establishes:
      'That a recognised public framework exists for organising these questions. Nothing about any specific monitor’s performance.',
    boundary:
      'Following a voluntary framework certifies nothing and supplies no acceptance criterion. Safety engineering for a physical machine requires qualified people and applicable standards.',
    checks: [
      'Ask what is monitored, at what rate, and what the fallback state is.',
      'Ask for the counts of true and false triggers during evaluation.',
      'Ask how an operator intervenes, how long that takes, and what the system does meanwhile.',
    ],
    sources: ['risk'],
    related: ['uncertainty-and-distribution-shift', 'planning-and-feedback-control', 'evaluation-fixture-example'],
    crossLinks: [
      { path: '/knowledge/robotics/intervention-and-autonomy', label: 'Robotics: counting assisted attempts honestly' },
      { path: '/knowledge/robotics/supervised-operation', label: 'Robotics: what supervision does and does not establish' },
    ],
  },
  {
    slug: 'benchmark-validity',
    title: 'What a benchmark score is evidence of',
    answer:
      'A benchmark score is evidence about that benchmark. Its value depends on whether the tasks, objects and scoring resemble the decision you are making.',
    explanation:
      'Meta-World supplies 50 distinct simulated manipulation tasks, and its authors report that while individual tasks and their variations could be learned, the algorithms they evaluated struggled to learn several tasks at once — even with as few as ten training tasks. That result is more useful than any leaderboard position, because it describes a limit that transfers: multi-task competence is not the sum of single-task competences. When reading any robotics or physical-AI benchmark, the questions are the same: how were tasks sampled, what counts as success, how many seeds, and does the reported number come from the same conditions the baseline used.',
    example:
      'Two papers report on the same suite with different reset policies — one re-randomises object pose each episode, the other does not. The scores are not comparable, and nothing in the headline number says so.',
    establishes:
      'That a published multi-task manipulation benchmark exists with 50 tasks, and that its authors reported multi-task learning difficulty as a finding.',
    boundary:
      'Simulated tasks with the benchmark’s own models and rewards. No benchmark score is a statement about a physical deployment.',
    checks: [
      'Ask how many seeds, and whether variance across seeds is reported.',
      'Ask whether the baseline was run by the same authors under the same conditions.',
      'Ask which aspects of your decision the task distribution does not cover at all.',
    ],
    sources: ['benchmark', 'vla'],
    related: ['vision-language-action-models', 'simulation-and-domain-randomization'],
    crossLinks: [
      { path: '/knowledge/robotics/benchmark-selection', label: 'Robotics: choosing a benchmark for the decision it informs' },
      { path: '/knowledge/robotics/replay-and-reproduction', label: 'Robotics: replaying a result rather than trusting it' },
    ],
  },
  {
    slug: 'data-provenance-and-permissions',
    title: 'Where the demonstrations came from, and what you are allowed to do with them',
    answer:
      'A robot dataset carries provenance and permission questions that a model card rarely answers: who was recorded, under which licence, and whether people appear in the frames.',
    explanation:
      'Demonstration data is collected in real spaces, often with cameras that capture more than the task. Three questions decide whether it can be used: the licence of the dataset and of each constituent source; whether people, faces or private spaces appear and under what consent; and whether the recorded operators agreed to their behaviour being redistributed. Pooled datasets make this harder, because a permissive aggregate licence does not override the terms of a constituent subset. Maha keeps the detailed lineage and rights machinery in the robotics section and links to it rather than duplicating it here.',
    example:
      'A policy is fine-tuned on an internal dataset recorded in a working lab. Before release, the licence question is not only about the images but about whether staff who appear incidentally in the wide-angle camera agreed to that use.',
    establishes:
      'Nothing empirical. This is a rights and provenance checklist Maha proposes for teams building on demonstration data.',
    boundary:
      'Not legal advice. Licence interpretation and consent requirements depend on jurisdiction and on the specific agreements involved.',
    checks: [
      'Ask for the licence of each constituent dataset, not only the aggregate.',
      'Ask whether people appear in any frame and what consent covers that appearance.',
      'Ask whether the deployment use is within the licence the data was collected under.',
    ],
    sources: [],
    related: ['learning-from-demonstration', 'benchmark-validity', 'simulation-and-domain-randomization'],
    crossLinks: [
      { path: '/knowledge/robotics/episode-rights', label: 'Robotics: rights attached to recorded episodes' },
      { path: '/knowledge/robotics/dataset-lineage', label: 'Robotics: dataset lineage records' },
    ],
  },
  {
    slug: 'evaluation-fixture-example',
    title: 'A runnable perception–action fixture, and what it is not',
    answer:
      'This section ships a small deterministic simulation of a perception–action loop with latency, noise, an uncertainty monitor, intervention and a failure report. It is a teaching fixture: it demonstrates the accounting, not any robot’s capability.',
    explanation:
      'The fixture runs a one-dimensional tracking task over fixed seeds. Each step produces a noisy observation, the controller acts on an observation delayed by a configurable number of steps, and a monitor may request intervention when the freshest observation disagrees with the running estimate. The report separates autonomous successes, assisted successes, failures and aborted runs, and splits monitor firings into those a deliberately injected disturbance explains and those it does not. Without an injected disturbance every firing is a nuisance alarm by construction, which is the cheapest way to see what a badly set threshold costs. Three counterexamples ship with it: latency alone changing the outcome, a threshold tightened past the noise floor, and a real disturbance that the monitor does catch.',
    example:
      'With seed 7, no delay and the monitor held off, the tracker reaches tolerance in four steps and the run is scored autonomous. With three steps of delay and everything else identical, the same controller diverges and the run is scored a failure with a final error near 5, the last observation and command retained. Tightening the monitor to 0.02 instead produces fourteen interventions on pure noise: the task still succeeds, but it is now scored assisted rather than autonomous.',
    establishes:
      'That latency and monitoring policy change closed-loop outcomes independently of perception accuracy, within this simulation.',
    boundary:
      'A synthetic one-dimensional simulation with no physics, no contact, no hardware and no people. Nothing it produces is evidence about a real robot’s capability or safety, and its numbers are properties of the fixture.',
    checks: [
      'Run it with delay 0 and delay 3 and compare the reports.',
      'Move the monitor threshold and watch nuisance interventions rise while task success does not.',
      'Try to make it report success it did not achieve; the scoring refuses unrecorded outcomes.',
    ],
    sources: [],
    related: ['perception-action-loops', 'runtime-monitoring-and-fallback', 'uncertainty-and-distribution-shift'],
  },
  {
    slug: 'state-estimation-and-filtering',
    title: 'State estimation: the system acts on an estimate, never on the world',
    answer:
      'A controller never sees the state it is controlling. It sees measurements, and acts on an estimate built from them. How much that estimate trusts the newest measurement is a parameter someone chose.',
    explanation:
      'The classical treatment makes the trade-off explicit. Welch and Bishop describe the Kalman filter as a cycle: a time update projects the state forward through a model of the dynamics, producing an a priori estimate; a measurement update then corrects it into an a posteriori estimate. The weighting between the two is a gain computed from the process-noise covariance Q, which says how much the model is trusted, and the measurement-noise covariance R, which says how much the sensor is trusted. Their limiting cases are the clearest statement of what the parameters mean: as R approaches zero the gain weights the residual more heavily, tending to the inverse of the measurement matrix, and as the a priori error covariance approaches zero the gain weights it less heavily, tending to zero. Put plainly, the filter trusts the measurement more as sensor noise falls, and trusts its own prediction more as it becomes confident. That confidence is computed from the assumed noise, not from whether the model is right. A filter given an over-optimistic Q becomes confident, stops listening to its sensors and drifts — and it does so quietly, because its reported covariance is small exactly when it should not be.',
    example:
      'A tracking system reports a tight uncertainty and a smooth trajectory while the object it is following has already left the modelled path. Nothing in the filter is broken. It was told the process noise was small, so it believed its own prediction, and a small reported covariance is the expected output of that assumption rather than evidence that the estimate is good.',
    establishes:
      'That estimation is a weighted compromise governed by stated noise assumptions, and that the confidence a filter reports is a function of those assumptions rather than an independent check on the estimate.',
    boundary:
      'A tutorial on a linear estimator under assumed Gaussian noise with known Q and R. It does not tell you the true noise of any sensor, does not settle the nonlinear or non-Gaussian case, and guarantees nothing about a robot that uses a filter. The fixture published in this section uses a trivial estimator, not a Kalman filter.',
    checks: [
      'Ask where Q and R came from — measured from the hardware, inherited from another project, or tuned until the output looked smooth.',
      'Ask whether the reported covariance has ever been compared against actual error on held-out data.',
      'Ask what the estimator does when a sensor drops out, and for how long its prediction is allowed to stand alone.',
      'Treat a smooth trajectory as evidence about the filter, not evidence about the world.',
    ],
    sources: ['estimation'],
    related: ['perception-action-loops', 'uncertainty-and-distribution-shift', 'planning-and-feedback-control'],
    crossLinks: [
      { path: '/knowledge/robotics/calibration-records', label: 'Robotics: the calibration records an estimate depends on' },
      { path: '/knowledge/mathematics', label: 'Mathematics: the formal layer under estimation' },
    ],
  },
  {
    slug: 'reward-specification',
    title: 'Reward specification: the objective is a proxy, and the system optimises the proxy',
    answer:
      'A learned system pursues the objective it was given, not the one that was meant. Where those differ, the difference is not a bug the system will correct — it is the direction the system will move in.',
    explanation:
      'Amodei and colleagues separate five concrete problems, two of which come from having the wrong objective function. The first is negative side effects: an objective names what to achieve and is thereby indifferent to everything it does not mention, so an agent rewarded for moving a box may knock over a vase in its path. The second is reward hacking, where the objective is satisfied by means nobody intended. Their examples are worth keeping because each names a distinct mechanism. A partially observed goal invites the cleaning robot rewarded by how few messes it sees to close its eyes. Goodhart’s law bites when a correlate is rewarded instead of the goal — reward bleach consumption because it correlates with cleaning, and the agent uses more bleach than it needs or pours it down the drain. Feedback loops let a behaviour amplify the signal that rewards it. Wireheading is the limiting case, where the agent tampers with the sensor that reports its score. For a physical system the consequence is sharper than for a recommender: the shortcut is taken in the world, against real objects, and the vase is real.',
    example:
      'A pick-and-place policy is rewarded for the object registering as lifted. It learns to nudge the object against the sensor. The reward curve is excellent, the reported success rate is high, and no object has been placed anywhere.',
    establishes:
      'That objective misspecification has distinguishable, named mechanisms, and that a good score is consistent with the system having found one of them rather than having done the task.',
    boundary:
      'A research agenda naming failure modes and proposing directions. It is not a result about any deployed system, supplies no detector for these failures, and says nothing about how often they occur in practice. Maha has measured no incidence of any of them.',
    checks: [
      'Ask what exactly is rewarded, and what physically has to be true for the reward to fire.',
      'Ask what the objective is silent about, and whether anything valuable sits in that silence.',
      'Ask whether success is judged by the same sensor the policy could influence.',
      'Look at the highest-scoring episodes rather than the average, since that is where a shortcut shows first.',
    ],
    sources: ['rewardhacking'],
    related: ['world-models', 'benchmark-validity', 'runtime-monitoring-and-fallback'],
  },
  {
    slug: 'foundation-model-fine-tuning',
    title: 'Fine-tuning a foundation model for control: what web pretraining does and does not transfer',
    answer:
      'Coupling a pretrained vision-language model to robot actions transfers semantic knowledge the robot data never contained. It does not transfer physical competence, and the evidence for each is different.',
    explanation:
      'Two reported systems mark the approach. In RT-2, Brohan and colleagues express robot actions as text tokens and co-fine-tune a pretrained vision-language model on robot trajectories together with internet-scale tasks such as visual question answering; they report improved generalisation to novel objects, the ability to follow commands absent from the robot training data, and rudimentary reasoning such as picking the smallest object or identifying a suitable implement, over some 6,000 evaluation trials. OpenVLA follows the same pattern as an open 7B model trained on 970k real demonstrations, which its authors report outperforming a 55B closed model by 16.5 percentage points of absolute task success across 29 tasks. What transfers is recognition and language grounding, because that is what the web corpus contains. What does not transfer is contact, force and timing, because no amount of image-text data observes them. The practical reading is that these systems generalise best along the axis the pretraining covered — naming and identifying things — and remain bounded by the robot data on the axis of actually moving them.',
    example:
      'A model correctly identifies which of several objects is a suitable hammer, having never seen one in its robot data, and then fails to grasp it because its fingers meet a surface geometry the demonstrations never contained. Both outcomes are what the training mix predicts.',
    establishes:
      'That co-fine-tuning on web and robot data is reported to add semantic generalisation beyond the robot dataset, and that the authors of each system report their own gains on their own evaluations.',
    boundary:
      'Both sets of figures are the authors’ own, on their own robots and evaluation suites, with no independent replication cited here. RT-2’s abstract reports capabilities rather than a headline success rate, and neither result establishes behaviour on a different embodiment, a different task set, or an unrehearsed setting.',
    checks: [
      'Ask which capability is claimed to come from pretraining and which from the robot data, and what evidence separates them.',
      'Ask whether the reported evaluation is the authors’ own, and whether anyone outside the group has reproduced it.',
      'Ask what fine-tuning data would be needed for your embodiment, since the reported models were trained on specific ones.',
      'Be precise that a semantic success — naming the right object — is not a manipulation success.',
    ],
    sources: ['rt2', 'vla'],
    related: ['vision-language-action-models', 'benchmark-validity', 'learning-from-demonstration'],
  },
  {
    slug: 'teleoperation-interfaces',
    title: 'The teleoperation interface is part of the dataset',
    answer:
      'Demonstrations are not neutral recordings of a task. They record what one operator could do through one interface, and the interface leaves its signature in every trajectory a policy learns from.',
    explanation:
      'Zhao, Kumar, Levine and Finn make the hardware part of the contribution: a low-cost bimanual teleoperation setup for collecting demonstrations, paired with Action Chunking with Transformers, which learns a generative model over sequences of actions rather than single actions. Their stated motivation for chunking is instructive about the data — compounding error in the policy and the non-stationarity of human demonstration, meaning the human was not a fixed function and did the task slightly differently each time. They report six fine manipulation tasks, including opening a translucent condiment cup and slotting a battery, at 80–90% success from roughly ten minutes of demonstrations in total. Maha’s addition is the evaluation consequence. Rate limits, latency, force feedback or its absence, and the operator’s own strategy all shape what the demonstrations contain, so a policy trained on them inherits an interface as well as a task. Two datasets nominally of the same task, collected through different rigs, are not interchangeable, and a data-efficiency figure quoted without its collection setup is missing the variable that produced it.',
    example:
      'A dataset collected on a rig without force feedback contains no examples of an operator easing off when a part binds, because the operator could not feel it. A policy trained on it has no such behaviour to imitate, and the gap will be read as a model limitation rather than a data one.',
    establishes:
      'That the collection interface is a documented part of a demonstration dataset, and that a reported data requirement is a property of a specific rig, operator and task set.',
    boundary:
      'The reported results are the authors’ own, on their own hardware and six chosen tasks. Ten minutes of demonstrations sufficing there is not a general data requirement, and nothing in it speaks to safety, durability or unattended operation.',
    checks: [
      'Ask what rig the demonstrations were collected on, and whether the operator had force feedback.',
      'Ask how many operators contributed and whether their strategies were compared.',
      'Ask whether a quoted data requirement came with its collection setup, and treat it as specific to that setup.',
      'Before merging two demonstration datasets, ask what differed between the interfaces that produced them.',
    ],
    sources: ['teleoperation', 'imitation'],
    related: ['learning-from-demonstration', 'data-provenance-and-permissions', 'benchmark-validity'],
    crossLinks: [
      { path: '/knowledge/robotics/episode-rights', label: 'Robotics: the rights and consent record a demonstration episode carries' },
    ],
  },
]

export type PhysicalAiCandidate = {
  slug: string
  question: string
  audience: string
  contribution: string
  status: 'implemented' | 'evidence-ready' | 'revise' | 'blocked' | 'duplicative'
  note?: string
  demand: 'unknown'
}

export const PHYSICAL_AI_CANDIDATES: PhysicalAiCandidate[] = [
  { slug: 'what-physical-ai-means', question: 'What is physical AI?', audience: 'Newcomer, executive', contribution: 'Definition and boundary against robotics, control and embodied AI', status: 'implemented', demand: 'unknown' },
  { slug: 'perception-action-loops', question: 'Why does offline accuracy not predict behaviour?', audience: 'Developer', contribution: 'Induced distribution and latency in one place', status: 'implemented', demand: 'unknown' },
  { slug: 'world-models', question: 'What is a world model and how does it fail?', audience: 'Developer, researcher', contribution: 'Model exploitation as a described failure mode', status: 'implemented', demand: 'unknown' },
  { slug: 'vision-language-action-models', question: 'What does a VLA success rate mean?', audience: 'Buyer, developer', contribution: 'Reads a headline generalist result as scoped evidence', status: 'implemented', demand: 'unknown' },
  { slug: 'learning-from-demonstration', question: 'How does teleoperated data become a policy?', audience: 'Developer', contribution: 'Operator and interface as dataset variables', status: 'implemented', demand: 'unknown' },
  { slug: 'simulation-and-domain-randomization', question: 'What does domain randomization buy?', audience: 'Developer', contribution: 'The randomized parameter list is the claim', status: 'implemented', demand: 'unknown' },
  { slug: 'planning-and-feedback-control', question: 'Planner or controller — which was replaced?', audience: 'Engineer', contribution: 'Attribution of failures across layers', status: 'implemented', demand: 'unknown' },
  { slug: 'uncertainty-and-distribution-shift', question: 'Can the model tell when it does not know?', audience: 'Developer, reviewer', contribution: 'From benchmark tendency to an operating point', status: 'implemented', demand: 'unknown' },
  { slug: 'runtime-monitoring-and-fallback', question: 'What happens when it is wrong?', audience: 'Operator, reviewer', contribution: 'Monitor, threshold, fallback and intervention as one specification', status: 'implemented', demand: 'unknown' },
  { slug: 'benchmark-validity', question: 'What is a benchmark score evidence of?', audience: 'Buyer, researcher', contribution: 'Multi-task difficulty as a transferable finding', status: 'implemented', demand: 'unknown' },
  { slug: 'data-provenance-and-permissions', question: 'May we use this demonstration data?', audience: 'Team lead', contribution: 'Rights questions specific to embodied data', status: 'implemented', demand: 'unknown' },
  { slug: 'evaluation-fixture-example', question: 'Can I see the accounting run?', audience: 'Developer', contribution: 'Deterministic loop fixture with intervention and failure reporting', status: 'implemented', demand: 'unknown' },
  { slug: 'state-estimation-and-filtering', question: 'How does a system know where it is?', audience: 'Engineer', contribution: 'Predict/correct weighting and why a filter’s own confidence is not a check on it', status: 'implemented', demand: 'unknown' },
  { slug: 'contact-rich-manipulation', question: 'Why is contact hard to learn?', audience: 'Developer', contribution: 'Contact dynamics and why sim transfer degrades there', status: 'blocked', note: 'Requires a contact-dynamics or force-control paper inspected at passage depth; not yet read.', demand: 'unknown' },
  { slug: 'locomotion-evaluation', question: 'How is legged locomotion evaluated?', audience: 'Reviewer', contribution: 'Terrain, disturbance and recovery metrics', status: 'blocked', note: 'Needs the primary locomotion literature read; deferred rather than summarised second-hand.', demand: 'unknown' },
  { slug: 'reward-specification', question: 'Why does a system optimise the wrong thing?', audience: 'Developer, reviewer', contribution: 'Named misspecification mechanisms: side effects, Goodhart, feedback loops, wireheading', status: 'implemented', demand: 'unknown' },
  { slug: 'sensor-calibration', question: 'How does calibration affect a learned policy?', audience: 'Engineer', contribution: 'Calibration drift as silent distribution shift', status: 'duplicative', note: 'Owned by /knowledge/robotics/calibration-records; this section links there rather than restating it.', demand: 'unknown' },
  { slug: 'time-synchronisation', question: 'What breaks when clocks disagree?', audience: 'Engineer', contribution: 'Synchronisation failures', status: 'duplicative', note: 'Owned by /knowledge/robotics/sensor-time-alignment.', demand: 'unknown' },
  { slug: 'execution-evidence', question: 'What evidence should an execution produce?', audience: 'Reviewer', contribution: 'Evidence packet contents', status: 'duplicative', note: 'Owned by /knowledge/robotics/evidence-package, the robotics evidence-package specification.', demand: 'unknown' },
  { slug: 'foundation-model-fine-tuning', question: 'What does web pretraining buy a robot?', audience: 'Buyer, developer', contribution: 'Separates transferred semantics from untransferred physical competence', status: 'implemented', demand: 'unknown' },
  { slug: 'teleoperation-interfaces', question: 'How does the interface shape the data?', audience: 'Team lead', contribution: 'Interface as a documented confounder in demonstration datasets', status: 'implemented', demand: 'unknown' },
  { slug: 'multimodal-perception', question: 'When does adding a sensor help?', audience: 'Developer', contribution: 'Marginal value of modalities', status: 'revise', note: 'Draft framing overlapped perception-action-loops without adding a distinct question.', demand: 'unknown' },
  { slug: 'energy-and-compute-budgets', question: 'What compute does on-robot inference need?', audience: 'Engineer, buyer', contribution: 'Latency and power budgets on device', status: 'revise', note: 'Needs measured figures Maha does not have; would otherwise restate vendor specifications.', demand: 'unknown' },
  { slug: 'human-robot-interaction', question: 'How should systems behave around people?', audience: 'Operator', contribution: 'Handover and shared space', status: 'duplicative', note: 'Owned by /knowledge/robotics/human-robot-handoff and accessibility-evaluation.', demand: 'unknown' },
]

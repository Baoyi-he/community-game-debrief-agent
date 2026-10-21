const form = document.querySelector("#guide-form");
const activitySelect = document.querySelector("#activity");
const activityContext = document.querySelector("#activity-context");
const observationField = document.querySelector("#observation");
const customCasePanel = document.querySelector("#custom-case-panel");
const caseFile = document.querySelector("#case-file");
const uploadStatus = document.querySelector("#upload-status");
const charCount = document.querySelector("#char-count");
const generateButton = document.querySelector("#generate-button");
const statusPill = document.querySelector("#model-status");
const emptyState = document.querySelector("#empty-state");
const loadingState = document.querySelector("#loading-state");
const errorState = document.querySelector("#error-state");
const resultContent = document.querySelector("#result-content");

let activities = {};
let latestResult = null;

function getCurrentActivity() {
  if (activitySelect.value !== "custom") return activities[activitySelect.value];
  const title = document.querySelector("#custom-title").value.trim() || "自定义课程案例";
  const theme = document.querySelector("#custom-theme").value.trim();
  const objective = document.querySelector("#custom-objective").value.trim();
  const game = document.querySelector("#custom-game").value.trim();
  const materials = document.querySelector("#custom-materials").value.trim();
  const filename = caseFile.files[0]?.name;
  return {
    day: "自定义案例",
    title,
    theme: theme || "请工作人员补充课程主题",
    objective: objective || "请工作人员补充学习目标",
    game: game || "请工作人员补充游戏或活动内容",
    facts: materials || "未提供课程材料文字；请仅根据工作人员填写的主题、目标和活动内容生成引导。",
    sources: [filename ? `用户上传材料：${filename}` : "工作人员填写的自定义案例"],
    avoid: "不要把模拟回应当成真实儿童发言；涉及安全内容时只引用已审核材料。",
  };
}

function setStatus(text, kind = "") {
  statusPill.className = `status-pill ${kind}`.trim();
  statusPill.replaceChildren();
  const dot = document.createElement("span");
  dot.className = "status-dot";
  const label = document.createElement("span");
  label.textContent = text;
  statusPill.append(dot, label);
}

function updateActivityContext() {
  const isCustom = activitySelect.value === "custom";
  customCasePanel.hidden = !isCustom;
  for (const selector of ["#custom-title", "#custom-theme", "#custom-objective", "#custom-game"]) {
    document.querySelector(selector).required = isCustom;
  }
  if (isCustom) {
    activityContext.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = "导入自己的案例";
    const description = document.createElement("div");
    description.textContent = "填写主题、目标和活动信息；上传的课程材料会先提取成文字供你检查。";
    activityContext.append(heading, description);
    return;
  }
  const activity = activities[activitySelect.value];
  if (!activity) return;
  activityContext.replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = `${activity.day} · ${activity.theme}`;
  const description = document.createElement("div");
  description.textContent = activity.game;
  activityContext.append(heading, description);
}

function makeSection(label, content, className = "") {
  const section = document.createElement("section");
  section.className = `result-section ${className}`.trim();
  const heading = document.createElement("div");
  heading.className = "section-label";
  heading.textContent = label;
  const paragraph = document.createElement("p");
  paragraph.className = "section-copy";
  paragraph.textContent = content;
  section.append(heading, paragraph);
  return section;
}

function makeFieldGuidance(guidance) {
  const section = document.createElement("section");
  section.className = "field-guidance";
  const heading = document.createElement("div");
  heading.className = "field-guidance-heading";
  const eyebrow = document.createElement("div");
  eyebrow.className = "section-label";
  eyebrow.textContent = "针对你记录的现场情况";
  const summary = document.createElement("p");
  summary.className = "section-copy";
  summary.textContent = guidance.observation_summary;
  heading.append(eyebrow, summary);

  const reply = document.createElement("div");
  reply.className = "suggested-reply";
  const replyLabel = document.createElement("div");
  replyLabel.className = "section-label";
  replyLabel.textContent = "工作人员可以这样回应";
  const replyText = document.createElement("p");
  replyText.className = "section-copy";
  replyText.textContent = `“${guidance.suggested_reply}”`;
  reply.append(replyLabel, replyText);

  section.append(heading, reply);
  section.append(makeSection("接下来可以问", guidance.next_question, "compact-section"));
  section.append(makeSection("怎样回到课程主题", guidance.thematic_connection, "compact-section"));
  const modeNote = document.createElement("p");
  modeNote.className = "field-mode-note";
  modeNote.textContent = guidance.mode_note;
  section.append(modeNote);
  return section;
}

function demoFieldGuidance(payload) {
  const observation = (payload.observation || "").trim();
  if (!observation) return null;
  const normalized = observation.replace(/\s/g, "");
  const garbageConcern = payload.activity_id === "garbage" &&
    ["一起运到垃圾场", "都运到垃圾场", "分类了", "做什么呢"].some((phrase) => normalized.includes(phrase));

  if (garbageConcern) {
    return {
      observation_summary: "孩子认为垃圾最后还是会被一起运走，因此在追问垃圾分类的意义。",
      suggested_reply: "先肯定这个问题，再区分“运走”和“后续处理”：可以说“你观察得很仔细，垃圾确实会被运走，但运走后不一定都用同一种方式处理。分类后，可利用的材料可以进入回收等相应流程，其他垃圾再按当地方式处理。分类不是让垃圾不被运走，而是让后续处理更合适。”",
      next_question: "“如果纸盒、果皮和废电池混在一起，后面的人还容易把能回收的东西分出来吗？分类以后，哪些东西可能有新的用途？”",
      thematic_connection: "把讨论带回课程总结：垃圾分类可以减轻处理压力、减少填埋，并让可利用的材料获得新价值。具体分类和去向请结合本地规则说明。",
      mode_note: "演示模式根据内置的“垃圾最后都运到垃圾场”示例给出建议；尚未连接语言模型。",
    };
  }

  return {
    observation_summary: "已收到你填写的现场情况。",
    suggested_reply: "当前没有连接语言模型，演示模式无法可靠分析这段自由描述。你可以先复述孩子的意思、肯定他的观察，再用一个开放问题请他多说一点。",
    next_question: "你觉得刚才最重要、最想让大家继续聊的一点是什么？",
    thematic_connection: "再从孩子提到的具体体验出发，对照当天课程目标，邀请他说明两者有什么联系。",
    mode_note: "这段自由描述尚未由语言模型分析；配置模型后才能生成更贴合现场的建议。",
  };
}

function renderResult(result) {
  latestResult = result;
  const activity = getCurrentActivity();
  resultContent.replaceChildren();
  resultContent.hidden = false;
  emptyState.hidden = true;
  loadingState.hidden = true;
  errorState.hidden = true;

  const header = document.createElement("div");
  header.className = "result-header";
  const titleGroup = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `${activity.day} · 分享引导建议`;
  const title = document.createElement("h2");
  title.textContent = activity.title;
  const subtitle = document.createElement("p");
  subtitle.className = "result-subtitle";
  subtitle.textContent = `${document.querySelector("#age-group").value} · ${document.querySelector("#duration").value}`;
  titleGroup.append(eyebrow, title, subtitle);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const mode = document.createElement("span");
  mode.className = `mode-label ${result.mode === "model" ? "model" : ""}`.trim();
  mode.textContent = result.mode === "model" ? "模型生成 · 模拟示例" : "演示模式 · 样例内容";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "copy-button";
  copy.textContent = "复制引导";
  copy.addEventListener("click", async () => {
    const text = formatResult(result, activity);
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = "已复制";
      window.setTimeout(() => { copy.textContent = "复制引导"; }, 1400);
    } catch {
      copy.textContent = "复制失败";
      window.setTimeout(() => { copy.textContent = "复制引导"; }, 1400);
    }
  });
  actions.append(mode, copy);
  header.append(titleGroup, actions);
  resultContent.append(header);

  if (result.field_guidance) {
    resultContent.append(makeFieldGuidance(result.field_guidance));
  }

  resultContent.append(makeSection("建议切入点", result.entry_point));

  const question = document.createElement("section");
  question.className = "result-section question-block";
  const qLabel = document.createElement("div");
  qLabel.className = "section-label";
  qLabel.textContent = "可以这样开场";
  const qText = document.createElement("p");
  qText.className = "section-copy";
  qText.textContent = `“${result.opening_question}”`;
  question.append(qLabel, qText);
  resultContent.append(question);

  const branchTitle = document.createElement("h3");
  branchTitle.className = "branches-title";
  branchTitle.textContent = "如果孩子这样回应，可以接着聊";
  resultContent.append(branchTitle);

  result.student_branches.forEach((branch, index) => {
    const card = document.createElement("article");
    card.className = "branch";
    const cardTitle = document.createElement("div");
    cardTitle.className = "branch-heading";
    const number = document.createElement("span");
    number.className = "branch-index";
    number.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("span");
    label.textContent = branch.label;
    cardTitle.append(number, label);

    const response = document.createElement("p");
    response.className = "branch-line simulated";
    response.textContent = `模拟回应：“${branch.simulated_response}”`;
    const followup = document.createElement("p");
    followup.className = "branch-line";
    const followupStrong = document.createElement("strong");
    followupStrong.textContent = "接着问：";
    followup.append(followupStrong, document.createTextNode(` “${branch.follow_up}”`));
    const bridge = document.createElement("p");
    bridge.className = "branch-line";
    const bridgeStrong = document.createElement("strong");
    bridgeStrong.textContent = "回到主题：";
    bridge.append(bridgeStrong, document.createTextNode(` ${branch.theme_bridge}`));
    card.append(cardTitle, response, followup, bridge);
    resultContent.append(card);
  });

  resultContent.append(makeSection("理解检查", result.understanding_check));
  resultContent.append(makeSection("课程材料依据", activity.sources.join("；")));
  const note = document.createElement("div");
  note.className = "facilitator-note";
  note.textContent = result.facilitator_note;
  resultContent.append(note);
}

function formatResult(result, activity) {
  const lines = [
    `${activity.day}｜${activity.title}：分享引导建议`,
    `切入点：${result.entry_point}`,
    `开场问题：${result.opening_question}`,
    "模拟学生回应与接话：",
  ];
  if (result.field_guidance) {
    lines.push(
      "针对现场情况：",
      result.field_guidance.observation_summary,
      `工作人员可以这样回应：${result.field_guidance.suggested_reply}`,
      `接下来可以问：${result.field_guidance.next_question}`,
      `回到课程主题：${result.field_guidance.thematic_connection}`,
      result.field_guidance.mode_note,
    );
  }
  result.student_branches.forEach((branch, index) => {
    lines.push(`${index + 1}. ${branch.label}`, `模拟回应：${branch.simulated_response}`, `接着问：${branch.follow_up}`, `回到主题：${branch.theme_bridge}`);
  });
  lines.push(`理解检查：${result.understanding_check}`, `工作人员提示：${result.facilitator_note}`);
  return lines.join("\n");
}

async function loadApp() {
  try {
    const [activityResponse, statusResponse] = await Promise.all([
      fetch("/activities.json", { cache: "no-store" }),
      fetch("/api/status", { cache: "no-store" }),
    ]);
    if (!activityResponse.ok || !statusResponse.ok) throw new Error("服务器返回异常。");
    activities = await activityResponse.json();
    const status = await statusResponse.json();

    Object.entries(activities).forEach(([id, activity]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = `${activity.day}　${activity.title}`;
      activitySelect.append(option);
    });
    const customOption = document.createElement("option");
    customOption.value = "custom";
    customOption.textContent = "＋ 导入自己的案例";
    activitySelect.append(customOption);
    activitySelect.value = "garbage";
    updateActivityContext();
    if (status.model_configured) {
      setStatus(`模型已连接 · ${status.model}`, "connected");
    } else {
      setStatus("演示模式 · 尚未连接模型", "demo");
    }
  } catch {
    setStatus("请通过本地服务打开页面", "demo");
    errorState.textContent = "页面初始化失败。请在项目目录运行 python server.py，再打开 http://127.0.0.1:8000。";
    errorState.hidden = false;
  }
}

activitySelect.addEventListener("change", updateActivityContext);
caseFile.addEventListener("change", async () => {
  const file = caseFile.files[0];
  uploadStatus.className = "upload-status";
  uploadStatus.textContent = "";
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    uploadStatus.classList.add("error");
    uploadStatus.textContent = "文件超过 8 MB，请压缩或改用较短的材料。";
    caseFile.value = "";
    return;
  }
  uploadStatus.textContent = "正在提取文字…";
  const upload = new FormData();
  upload.append("file", file);
  try {
    const response = await fetch("/api/extract-case", { method: "POST", body: upload });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "文件提取失败。");
    const materialsField = document.querySelector("#custom-materials");
    materialsField.value = result.text;
    uploadStatus.textContent = `已提取 ${result.characters} 个字符。请检查文字是否完整；${result.note || ""}`;
  } catch (error) {
    uploadStatus.classList.add("error");
    uploadStatus.textContent = error.message || "文件提取失败，请改用 TXT、MD、DOCX 或可复制文字的 PDF。";
    caseFile.value = "";
  }
});
observationField.addEventListener("input", () => {
  charCount.textContent = `${observationField.value.length} / 1200`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorState.hidden = true;
  emptyState.hidden = true;
  resultContent.hidden = true;
  loadingState.hidden = false;
  generateButton.disabled = true;
  generateButton.querySelector("span:first-child").textContent = "正在生成…";

  const formData = new FormData(form);
  const payload = {
    activity_id: formData.get("activity_id"),
    age_group: formData.get("age_group"),
    duration: formData.get("duration"),
    observation: formData.get("observation"),
  };
  if (payload.activity_id === "custom") {
    payload.custom_activity = {
      title: document.querySelector("#custom-title").value.trim(),
      theme: document.querySelector("#custom-theme").value.trim(),
      objective: document.querySelector("#custom-objective").value.trim(),
      game: document.querySelector("#custom-game").value.trim(),
      materials: document.querySelector("#custom-materials").value.trim(),
      filename: caseFile.files[0]?.name || "",
    };
  }
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "生成失败，请重试。");
    if (result.mode === "demo" && payload.observation?.trim() && !result.field_guidance) {
      result.field_guidance = demoFieldGuidance(payload);
      result.facilitator_note = "演示模式未调用语言模型；下方针对现场情况的建议来自内置示例规则或通用引导框架。垃圾分类和处理去向请按活动所在地规则说明。";
    }
    renderResult(result);
  } catch (error) {
    loadingState.hidden = true;
    errorState.textContent = error.message || "生成失败，请检查模型配置后重试。";
    errorState.hidden = false;
  } finally {
    generateButton.disabled = false;
    generateButton.querySelector("span:first-child").textContent = "生成分享引导";
  }
});

loadApp();

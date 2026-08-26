import { type FormEvent, useEffect, useState, type ReactNode } from "react";
import { App, Button, Checkbox, Divider, Input } from "antd";
import { ArrowRight, Info, LockKeyhole, Mail, Mountain, ShieldCheck, TriangleAlert, UserRound } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { applyUserSession } from "@/lib/user-session";
import { getAuthSession, getAuthSettings, linuxDOLoginURL, register, sendRegistrationEmailCode } from "@/services/api/auth";
import { validateInviteCode } from "@/services/api/invite";
import { LinuxDOIcon } from "./auth-scene";

type AuthSettings = Awaited<ReturnType<typeof getAuthSettings>>;

// 邀请码失焦校验状态：idle / checking / valid / invalid。
type InviteValidationState = "idle" | "checking" | "valid" | "invalid";

export default function RegisterPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { message } = App.useApp();
    const [settings, setSettings] = useState<AuthSettings | null>(null);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [emailCode, setEmailCode] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [inviteValidation, setInviteValidation] = useState<InviteValidationState>("idle");
    const [submitting, setSubmitting] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);
    // 法律协议勾选：三项均勾选才允许提交注册
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [agreedPrivacy, setAgreedPrivacy] = useState(false);
    const [agreedDmca, setAgreedDmca] = useState(false);
    const next = safeNext(params.get("next"));

    // 邀请链接 https://mosliy.com/?invite=XXXX 自动填充到表单（spec §3.3）。
    useEffect(() => {
        const codeFromURL = params.get("invite");
        if (codeFromURL) setInviteCode(codeFromURL.trim());
    }, [params]);

    useEffect(() => {
        let cancelled = false;
        void getAuthSettings().then((value) => !cancelled && setSettings(value)).catch((error) => !cancelled && message.error(error instanceof Error ? error.message : "读取注册设置失败"));
        return () => { cancelled = true; };
    }, [message]);

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
        return () => window.clearInterval(timer);
    }, [countdown]);

    const sendCode = async () => {
        if (!email.trim()) {
            message.warning("请先输入邮箱");
            return;
        }
        setSendingCode(true);
        try {
            await sendRegistrationEmailCode(email.trim());
            setCountdown(60);
            message.success("验证码已发送，请检查邮箱");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "发送验证码失败");
        } finally {
            setSendingCode(false);
        }
    };

    // 邀请码失焦校验：仅当公共注册关闭且邀请码非空时触发（spec TR-09-02）。
    // 一期后端 mock 对任何非空 code 返回 valid=true，这里仍走完整异步链路以便二期接真实校验。
    const checkInviteCode = async () => {
        const trimmed = inviteCode.trim();
        if (trimmed === "") {
            setInviteValidation("idle");
            return;
        }
        setInviteValidation("checking");
        try {
            const result = await validateInviteCode(trimmed);
            setInviteValidation(result.valid ? "valid" : "invalid");
        } catch (error) {
            setInviteValidation("invalid");
            message.error(error instanceof Error ? error.message : "邀请码校验失败");
        }
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (password !== confirmPassword) {
            message.error("两次输入的密码不一致");
            return;
        }
        // 公共注册关闭时，强制要求邀请码通过校验（spec §3.3 / TR-09-02）。
        if (registrationClosed) {
            if (inviteCode.trim() === "") {
                message.error("管理员未开放公共注册，请填写邀请码");
                return;
            }
            if (inviteValidation !== "valid") {
                message.error("请填写有效的邀请码");
                return;
            }
        }
        setSubmitting(true);
        try {
            await register({ username, email, emailCode, displayName, password, inviteCode: inviteCode.trim() || undefined });
            await applyUserSession(await getAuthSession());
            if (!settings?.firstUser) window.sessionStorage.setItem("infinite-canvas:model-setup-guide", "1");
            message.success(settings?.firstUser ? "管理员账号已创建" : "注册成功");
            navigate(next, { replace: true });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "注册失败");
        } finally {
            setSubmitting(false);
        }
    };

    const registrationClosed = settings?.registrationEnabled === false;
    const mailUnavailable = Boolean(settings && !settings.firstUser && settings.emailCodeRequired && !settings.emailEnabled);
    // 公共注册关闭时仍允许通过邀请码注册（spec §3.3），仅当邮件服务不可用时禁用依赖邮箱的字段。
    const disabled = mailUnavailable;
    const requireCode = Boolean(settings && !settings.firstUser && settings.emailCodeRequired);
    // 公共注册关闭：邀请码必填且必须 valid；公共注册开启：邀请码可空，按钮不受邀请码状态约束。
    const inviteRequired = registrationClosed;
    const inviteValid = inviteValidation === "valid";
    const inviteBlocking = inviteRequired && !inviteValid;
    // 邀请码 label 在公共注册开启时标注「可选」（spec TR-09-03）。
    const inviteLabel = `幕山攀登计划邀请码${inviteRequired ? "" : "（可选）"}`;

    return (
        <form onSubmit={submit} className="space-y-4">
            {settings?.firstUser ? <Notice icon={<Info className="size-3.5" />} tone="blue">首个账号自动成为管理员，邮箱验证码与邀请码均不要求。</Notice> : null}
            {registrationClosed ? <Notice icon={<TriangleAlert className="size-3.5" />} tone="amber">当前已关闭普通注册，请填写有效的幕山攀登计划邀请码完成注册。</Notice> : null}
            {mailUnavailable ? <Notice icon={<TriangleAlert className="size-3.5" />} tone="amber">管理员尚未配置注册邮件，普通邮箱注册暂不可用。</Notice> : null}

            <div className="grid gap-4 sm:grid-cols-2">
                <AuthField label="用户名"><Input size="large" prefix={<UserRound className="size-4 text-white/35" />} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="3-32 位字符" autoComplete="username" required disabled={disabled} /></AuthField>
                <AuthField label="显示名称"><Input size="large" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="不填则使用用户名" disabled={disabled} /></AuthField>
            </div>

            <AuthField label="邮箱"><Input size="large" prefix={<Mail className="size-4 text-white/35" />} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="用于登录与安全验证" autoComplete="email" required={!settings?.firstUser} disabled={disabled} /></AuthField>

            {requireCode ? (
                <AuthField label="邮箱验证码">
                    <div className="grid grid-cols-[minmax(0,1fr)_116px] gap-2">
                        <Input size="large" prefix={<ShieldCheck className="size-4 text-white/35" />} value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 位验证码" inputMode="numeric" autoComplete="one-time-code" required disabled={disabled} />
                        <Button size="large" loading={sendingCode} disabled={disabled || countdown > 0} onClick={() => void sendCode()}>{countdown > 0 ? `${countdown}s` : "获取验证码"}</Button>
                    </div>
                </AuthField>
            ) : null}

            <AuthField label={inviteLabel}>
                <Input
                    size="large"
                    prefix={<Mountain className="size-4 text-white/35" />}
                    value={inviteCode}
                    onChange={(event) => {
                        setInviteCode(event.target.value);
                        // 编辑后重置校验态，避免显示陈旧结果。
                        setInviteValidation("idle");
                    }}
                    onBlur={() => void checkInviteCode()}
                    placeholder={inviteRequired ? "必填，失焦后自动校验" : "可空，公共注册开启时无需填写"}
                    disabled={disabled}
                    aria-invalid={inviteValidation === "invalid"}
                />
                {inviteValidation === "checking" ? <p className="mt-1 text-xs text-white/45">正在校验邀请码……</p> : null}
                {inviteValidation === "valid" ? <p className="mt-1 text-xs text-emerald-200/80">邀请码可用，继续完成注册。</p> : null}
                {inviteValidation === "invalid" ? <p className="mt-1 text-xs text-rose-200/80">邀请码无效或已被使用。</p> : null}
            </AuthField>

            <div className="grid gap-4 sm:grid-cols-2">
                <AuthField label="密码"><Input.Password size="large" prefix={<LockKeyhole className="size-4 text-white/35" />} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" autoComplete="new-password" required disabled={disabled} /></AuthField>
                <AuthField label="确认密码"><Input.Password size="large" prefix={<LockKeyhole className="size-4 text-white/35" />} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入密码" autoComplete="new-password" required disabled={disabled} /></AuthField>
            </div>

            {/* 法律协议勾选：注册按钮在未全部勾选时禁用，叠加原 disabled 与邀请码阻塞条件 */}
            <div className="space-y-2">
                <Checkbox checked={agreedTerms} onChange={(event) => setAgreedTerms(event.target.checked)}>
                    <span className="text-xs text-white/62">我已阅读并同意<Link to="/legal/user-agreement" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white">《用户协议》</Link></span>
                </Checkbox>
                <Checkbox checked={agreedPrivacy} onChange={(event) => setAgreedPrivacy(event.target.checked)}>
                    <span className="text-xs text-white/62">我已阅读并同意<Link to="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white">《隐私政策》</Link></span>
                </Checkbox>
                <Checkbox checked={agreedDmca} onChange={(event) => setAgreedDmca(event.target.checked)}>
                    <span className="text-xs text-white/62">我已阅读并同意<Link to="/legal/dmca" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white">《版权投诉与 DMCA 流程》</Link></span>
                </Checkbox>
            </div>

            <Button type="primary" htmlType="submit" size="large" block loading={submitting} disabled={disabled || inviteBlocking || !(agreedTerms && agreedPrivacy && agreedDmca)} icon={<ArrowRight className="size-4" />} iconPlacement="end">创建账号</Button>
            {settings?.linuxdoEnabled ? <><Divider plain className="!border-white/10 !text-white/30">或</Divider><Button size="large" block icon={<LinuxDOIcon />} href={linuxDOLoginURL(next)}>使用 Linux.do 注册 / 登录</Button></> : null}
        </form>
    );
}

function AuthField({ label, children }: { label: string; children: ReactNode }) {
    return <label className="block space-y-2"><span className="text-xs font-medium text-white/62">{label}</span>{children}</label>;
}

function Notice({ icon, tone, children }: { icon: ReactNode; tone: "blue" | "amber"; children: ReactNode }) {
    return <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-5 ${tone === "blue" ? "border-blue-300/15 bg-blue-300/[0.06] text-blue-100/78" : "border-amber-300/15 bg-amber-300/[0.06] text-amber-100/78"}`}><span className="mt-0.5 shrink-0">{icon}</span>{children}</div>;
}

function safeNext(value: string | null) {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return "/create";
    return value;
}

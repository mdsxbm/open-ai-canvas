import { Checkbox } from "antd";

// 投拍提交前的合规声明（spec §4.3）：勾选后才允许提交生成任务。
export function ComplianceCheckbox({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <Checkbox data-testid="compliance-checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}>
            我确认本次输入不违反社区规范与法律，同意内容被自动审核
        </Checkbox>
    );
}

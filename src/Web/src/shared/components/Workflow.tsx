import type { ComponentProps, ReactNode } from "react";
import { Badge } from "./design-system";
import { Panel } from "./ui";
import "./workflow.css";

type WorkflowStatusProps = {
  status: string;
  tone?: ComponentProps<typeof Badge>["tone"];
  nextStep: string;
  action?: ReactNode;
};

/** State what happened and who should act next. Supply an action when the viewer can proceed. */
export function WorkflowStatus({ status, tone, nextStep, action }: WorkflowStatusProps) {
  return (
    <div className="mgt-workflow-status">
      <div>
        <Badge tone={tone}>{status}</Badge>
        <p>{nextStep}</p>
      </div>
      {action && <div className="mgt-workflow-actions">{action}</div>}
    </div>
  );
}

type WorkQueueItem = WorkflowStatusProps & {
  id: string;
  title: string;
  detail?: string;
};

export function WorkQueue({
  title,
  items,
  emptyMessage,
  footer,
}: {
  title: string;
  items: readonly WorkQueueItem[];
  emptyMessage: string;
  footer?: ReactNode;
}) {
  return (
    <Panel title={title} className="mgt-work-queue mgt-motion-enter">
      {items.length > 0 ? (
        <ul>
          {items.map(({ id, title: itemTitle, detail, ...status }) => (
            <li key={id}>
              <div className="mgt-work-queue-item">
                <strong>{itemTitle}</strong>
                {detail && <p>{detail}</p>}
              </div>
              <WorkflowStatus {...status} />
            </li>
          ))}
        </ul>
      ) : <p>{emptyMessage}</p>}
      {footer}
    </Panel>
  );
}

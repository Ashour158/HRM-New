# Account-level cost alerting. Complements (does not replace) the in-cluster
# HcmHpaAtMaxReplicasSustained Prometheus alert (deploy/observability/prometheus-rules.yaml,
# deployed for real by deploy/k8s/observability/) — that one is a capacity/cost *signal*
# from inside the cluster, this one is a hard spend ceiling at the AWS billing layer.

resource "aws_budgets_budget" "monthly_cost_guardrail" {
  name         = "${var.project_name}-monthly-cost-guardrail"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_limit_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Warn early on actual spend trajectory.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  # Warn if the forecast alone would blow through the ceiling.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.budget_alert_emails
  }

  # Optional SNS fan-out (e.g. to PagerDuty/Slack via a subscription) — only created
  # when budget_alert_sns_topic_arn is actually supplied.
  dynamic "notification" {
    for_each = var.budget_alert_sns_topic_arn == "" ? [] : [1]
    content {
      comparison_operator       = "GREATER_THAN"
      threshold                 = 90
      threshold_type            = "PERCENTAGE"
      notification_type         = "ACTUAL"
      subscriber_sns_topic_arns = [var.budget_alert_sns_topic_arn]
    }
  }
}

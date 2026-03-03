import { type ButtonHTMLAttributes, Component } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "light"
    | "dark";
}

export default class Button extends Component<ButtonProps, unknown> {
  override render() {
    const { variant, children, ...buttonProps } = this.props;
    const classNames = [
      "px-4",
      "py-2",
      "rounded-md",
      "transition",
      "ease-in-out",
      "duration-150",
      "focus:shadow-equal",
      "focus:outline-none",
      "border",
      "border-transparent",
      "ring-2",
      "ring-transparent",
      "focus:outline-none",
      "disabled:opacity-50",
      "disabled:cursor-not-allowed",
    ];

    switch (variant) {
      case "primary":
        classNames.push(
          "bg-primary",
          "text-primary-foreground",
          "hover:opacity-90",
          "focus:ring-primary",
        );
        break;
      case "secondary":
        classNames.push(
          "bg-secondary",
          "text-secondary-foreground",
          "border-border",
          "hover:bg-accent",
          "focus:ring-primary",
        );
        break;
      case "success":
        classNames.push(
          "bg-success",
          "text-success-foreground",
          "hover:opacity-90",
          "focus:ring-success",
        );
        break;
      case "danger":
        classNames.push(
          "bg-destructive",
          "text-destructive-foreground",
          "hover:opacity-90",
          "focus:ring-destructive",
        );
        break;
      case "warning":
        classNames.push(
          "bg-warning",
          "text-warning-foreground",
          "hover:opacity-90",
          "focus:ring-warning",
        );
        break;
      case "info":
        classNames.push(
          "bg-primary",
          "text-primary-foreground",
          "hover:opacity-90",
          "focus:ring-primary",
        );
        break;
      case "light":
        classNames.push(
          "bg-muted",
          "text-foreground",
          "hover:bg-accent",
          "focus:ring-ring",
        );
        break;
      case "dark":
        classNames.push(
          "bg-foreground",
          "text-background",
          "hover:opacity-90",
          "focus:ring-ring",
        );
        break;
    }

    return (
      <button
        {...buttonProps}
        className={[
          ...classNames,
          ...(buttonProps.className ?? "").split(" "),
        ].join(" ")}
      >
        {children}
      </button>
    );
  }
}

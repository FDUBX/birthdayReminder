import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BirthdayForm from "../src/components/BirthdayForm";
describe("BirthdayForm", () => {
    it("submits name + parsed date with optional year", () => {
        const onSubmit = vi.fn();
        render(_jsx(BirthdayForm, { onSubmit: onSubmit, onCancel: () => { } }));
        fireEvent.change(screen.getByPlaceholderText("Nom"), { target: { value: "Anna" } });
        fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-03-15" } });
        fireEvent.click(screen.getByText("Enregistrer"));
        expect(onSubmit).toHaveBeenCalledWith({ name: "Anna", birth_month: 3, birth_day: 15, birth_year: 2026 });
    });
    it("submits null year when 'année inconnue' is checked", () => {
        const onSubmit = vi.fn();
        render(_jsx(BirthdayForm, { onSubmit: onSubmit, onCancel: () => { } }));
        fireEvent.change(screen.getByPlaceholderText("Nom"), { target: { value: "Bob" } });
        fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-07-22" } });
        fireEvent.click(screen.getByLabelText("Année inconnue"));
        fireEvent.click(screen.getByText("Enregistrer"));
        expect(onSubmit).toHaveBeenCalledWith({ name: "Bob", birth_month: 7, birth_day: 22, birth_year: null });
    });
});

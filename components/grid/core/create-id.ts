import { nanoid } from "nanoid";

export const SCOPE_ALPHABET = "__opencode_grid__"

export const withIdScope = (scope: string = SCOPE_ALPHABET) =>
    (size: number = 12): string => `${scope}${nanoid(size)}`;

export const createId = withIdScope();

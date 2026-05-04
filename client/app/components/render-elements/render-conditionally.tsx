export function RenderConditionally({ condition, children }: { condition: boolean; children: React.ReactNode }) {
    if (!condition) {
        return null;
    }
    return <>{children}</>;
}
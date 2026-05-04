export function RenderAlternatively({
    condition,
    children,
}: {
    condition: boolean;
    children: [React.ReactNode, React.ReactNode];
}) {
    const [trueElement, falseElement] = children;
    return <>{condition ? trueElement : falseElement}</>;
}   
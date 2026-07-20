import { Node } from "@tiptap/core";
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        customImage: {
            setCustomImage: (options: {
                src: string;
                alt?: string;
                title?: string;
            }) => ReturnType;
        };
    }
}
export declare const CustomImage: Node<any, any>;
//# sourceMappingURL=ImageNode.d.ts.map
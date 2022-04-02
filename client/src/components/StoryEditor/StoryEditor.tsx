import dynamic from 'next/dynamic';
import { isEqual } from 'lodash-es';
import { toast } from 'react-hot-toast';
import { OutputData } from '@editorjs/editorjs';
import { useCallback, useState } from 'react';
import { OutputBlockData } from '@editorjs/editorjs/types/data-formats/output-data';

import {
	useCreateBlocksMutation,
	useDeleteBlocksMutation,
	useGetStoryByIdQuery,
	useUpdateStoryMutation,
} from '@services/Story.generated';
import { FullName } from '@lib/utils';
import { Story_Enum_Block_Type_Enum } from '@lib/gqlTypes';
import { useDelayedDebounce } from '@hooks/useDelayedDebounce';
import Link from 'next/link';

const EditorJs = dynamic(() => import('@components/EditorJs/EditorJs'), { ssr: false });

enum NetworkState {
	UNSAVED = '',
	SAVING = 'Saving...',
	SAVED = 'Saved',
}

export type StoryEditorProps = {
	storyId: string;
};

export function StoryEditor({ storyId }: StoryEditorProps) {
	const [title, setTitle] = useState<string>('');
	const [subtitle, setSubtitle] = useState<string>('');
	const [hasChanges, setHasChanges] = useState<boolean>(false);
	const [editorData, setEditorData] = useState<OutputData | null>(null);
	const [networkState, setNetworkState] = useState<NetworkState>(NetworkState.SAVED);

	const queryResults = useGetStoryByIdQuery({
		variables: { storyId },
		onCompleted: (data) => {
			setTitle(data.story_story_by_pk?.title ?? '');
			setSubtitle(data.story_story_by_pk?.subtitle ?? '');
			setEditorData({
				time: new Date().getTime(),
				blocks: (data.story_story_by_pk?.blocks ?? []).map((block) => ({
					id: block.id,
					type: block.type,
					data: block.data,
				})),
			});
		},
	});

	const [updateStoryFn] = useUpdateStoryMutation({
		onCompleted: () => {
			toast('Changes saved');
			queryResults.refetch({ storyId });
		},
	});
	const [createBlocksFn] = useCreateBlocksMutation();
	const [deleteBlocksFn] = useDeleteBlocksMutation();

	useDelayedDebounce({
		dependencies: [title, subtitle, hasChanges],
		callbackFn: async () => {
			let changesMade: boolean = false;
			const { data, loading } = queryResults;
			const storyData = data?.story_story_by_pk;
			if (!loading && data) {
				if (storyData?.title !== title || storyData?.subtitle !== subtitle) {
					setNetworkState(NetworkState.SAVING);
					await updateStoryFn({
						variables: {
							storyId,
							story: {
								title,
								subtitle,
							},
						},
					});
					changesMade = true;
				}
				if (hasChanges) {
					setNetworkState(NetworkState.SAVING);
					const editorBlocks = editorData?.blocks ?? [];
					const storyBlocks = data?.story_story_by_pk?.blocks ?? [];

					await deleteBlocksFn({
						variables: {
							blockIds: storyBlocks.map((b) => b.id),
						},
					});

					await createBlocksFn({
						variables: {
							blocks: editorBlocks.map((block, blockIdx) => ({
								seq: blockIdx,
								data: block.data,
								story_id: storyId,
								type: block.type as Story_Enum_Block_Type_Enum,
							})),
						},
					});

					setHasChanges(false);
					changesMade = true;
				}

				if (changesMade) {
					setNetworkState(NetworkState.SAVED);
					await queryResults.refetch({ storyId });
				}
			}
		},
	});

	const setBlocks = useCallback((blocks: OutputBlockData[]) => {
		let foundChanges = false;
		setEditorData((curEditorData) => {
			if (!isEqual(curEditorData?.blocks ?? [], blocks)) {
				foundChanges = true;
				return { ...curEditorData, blocks };
			}
			return curEditorData;
		});
		setHasChanges(foundChanges);
	}, []);

	if (queryResults.loading) {
		return <h1>Loading story...</h1>;
	}

	if (queryResults.error) {
		return (
			<h1>
				Error:
				{queryResults.error.message}
			</h1>
		);
	}

	if (!queryResults.data || !queryResults.data.story_story_by_pk) {
		return <h1 className="text-3xl">Story not found</h1>;
	}

	return (
		<div className="flex flex-col pt-5 w-full max-w-prose">
			<div className="flex items-center space-x-4">
				<Link href="/" passHref>
					<a className="font-extrabold tracking-tight text-3xl">smol</a>
				</Link>
				<span>
					{queryResults.data.story_story_by_pk.visibility}
					{' '}
					in
					{' '}
					{FullName(queryResults.data.story_story_by_pk.author)}
				</span>
				<span>
					{networkState}
				</span>
			</div>
			<div className="flex flex-col pt-8 w-full max-w-prose">

				<label htmlFor="title">
					<span className="sr-only">Title</span>
					<input
						id="title"
						value={title}
						placeholder="Title"
						className="w-full focus:outline-none border-b-2 border-transparent focus:border-slate-800/25
                        tracking-tight text-gray-900 font-extrabold text-3xl whitespace-normal resize-none pb-2"
						onChange={({ target }) => setTitle(target.value)}
					/>
				</label>

				<label htmlFor="subtitle">
					<span className="sr-only">Subtitle</span>
					<input
						id="subtitle"
						value={subtitle}
						placeholder="Subtitle"
						className="w-full focus:outline-none border-b-2 border-transparent focus:border-slate-800/25
                        tracking-tight text-gray-600 font-base text-xl whitespace-normal resize-none pb-2"
						onChange={({ target }) => setSubtitle(target.value)}
					/>
				</label>

				<div className="flex flex-col space-y-8">
					{ editorData && (
						<EditorJs
							onChange={setBlocks}
							defaultValue={editorData}
						/>
					) }
				</div>
			</div>
		</div>
	);
}

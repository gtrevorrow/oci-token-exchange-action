// At the very top, set up all mocks before importing main
let mockPlatformInstance: any;
jest.doMock('fs/promises', () => ({
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    chmod: jest.fn(),
    readFile: jest.fn(),
    rename: jest.fn(),
}));
jest.doMock('path', () => ({
    resolve: jest.fn(),
    join: jest.fn(),
    dirname: jest.fn(),
    basename: jest.fn(),
}));
jest.doMock('../platforms/github');
jest.doMock('../platforms/cli');
jest.doMock('axios');




import { jest, expect, describe, it, beforeEach, afterEach } from '@jest/globals';
import { TokenExchangeError } from '../main'; // Only import TokenExchangeError directly
import { GitHubPlatform } from '../platforms/github';
import { CLIPlatform } from '../platforms/cli';
import { Platform } from '../platforms/types';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

import * as mainModule from '../main'; // Import after all mocks

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedPath = path as jest.Mocked<typeof path>;

const MockedGitHubPlatform = GitHubPlatform as jest.MockedClass<typeof GitHubPlatform>;
const MockedCLIPlatform = CLIPlatform as jest.MockedClass<typeof CLIPlatform>;



describe('main (Integration)', () => {
    let mainFunction: typeof mainModule.main;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {};
        process.env.HOME = '/mock/home';

        mockPlatformInstance = {
            getInput: jest.fn((name: string, required?: boolean) => {
                const inputs: { [key: string]: string } = {
                    'oidc_client_identifier': 'test-client-id',
                    'domain_base_url': 'https://auth.example.com',
                    'oci_tenancy': 'test-tenancy',
                    'oci_region': 'us-test-1',
                };
                const value = inputs[name] || '';
                if (required && !value) {
                    throw new Error(`Input required and not supplied: ${name}`);
                }
                return value;
            }),
            getOIDCToken: jest.fn<() => Promise<string>>().mockResolvedValue('mock-oidc-token'),
            setOutput: jest.fn(),
            setFailed: jest.fn(),
            isDebug: jest.fn<() => boolean>().mockReturnValue(false),
            logger: {
                debug: jest.fn(),
                info: jest.fn(),
                warning: jest.fn(),
                error: jest.fn(),
            },
        };

        MockedGitHubPlatform.mockImplementation(() => mockPlatformInstance as any);
        MockedCLIPlatform.mockImplementation(() => mockPlatformInstance as any);

        mockedFs.mkdir.mockResolvedValue(undefined);
        mockedFs.writeFile.mockResolvedValue(undefined);
        mockedFs.chmod.mockResolvedValue(undefined);
        mockedFs.readFile.mockResolvedValue('');
        mockedFs.rename.mockResolvedValue(undefined);

        mockedPath.resolve.mockImplementation((...parts: string[]) => {
            if (parts.length === 0) return '/mock/home';
            let resolvedPath = parts[0];
            if (!resolvedPath.startsWith('/')) {
                resolvedPath = '/mock/home/' + resolvedPath;
            }
            for (let i = 1; i < parts.length; i++) {
                resolvedPath = resolvedPath + '/' + parts[i];
            }
            return resolvedPath.replace(/\/\/+/, '/');
        });
        mockedPath.join.mockImplementation((...parts: string[]) => parts.join('/').replace(/\/\/+/, '/'));
        mockedPath.dirname.mockImplementation((p: string) => {
            const parts = p.split('/');
            parts.pop();
            return parts.join('/') || '/';
        });
        mockedPath.basename.mockImplementation((p: string) => {
            const parts = p.split('/');
            return parts[parts.length - 1];
        });


        mockedAxios.post.mockResolvedValue({ data: { token: 'mock-upst-token' } });

        mainFunction = mainModule.main;
    });

    afterEach(() => {
        // No need to restore spies if we are directly mocking the module functions
    });

    it('should run successfully with default GitHub platform', async () => {
        process.env.PLATFORM = 'github';

        await mainFunction();

        expect(MockedGitHubPlatform).toHaveBeenCalledTimes(1);
        expect(mockPlatformInstance.getInput).toHaveBeenCalledWith('oidc_client_identifier', true);
        expect(mockPlatformInstance.getOIDCToken).toHaveBeenCalledTimes(1);
        // No direct call count checks; effects are validated by outputs and mocks
        expect(mockPlatformInstance.setOutput).toHaveBeenCalledWith('oci_config_path', expect.any(String));
        expect(mockPlatformInstance.setOutput).toHaveBeenCalledWith('oci_session_token_path', expect.any(String));
        expect(mockPlatformInstance.setOutput).toHaveBeenCalledWith('oci_private_key_path', expect.any(String));
        expect(mockPlatformInstance.setOutput).toHaveBeenCalledWith('configured', 'true');
        expect(mockPlatformInstance.setFailed).not.toHaveBeenCalled();
    });

    it('should prefer ci_platform input over PLATFORM environment variable', async () => {
        process.env.PLATFORM = 'github';
        process.env.INPUT_CI_PLATFORM = 'gitlab';

        await mainFunction();

        expect(MockedCLIPlatform).toHaveBeenCalledTimes(1);
        expect(MockedGitHubPlatform).not.toHaveBeenCalled();
    });

    it('should use CLIPlatform for bitbucket platform selection', async () => {
        process.env.PLATFORM = 'bitbucket';

        await mainFunction();

        expect(MockedCLIPlatform).toHaveBeenCalledTimes(1);
        expect(MockedGitHubPlatform).not.toHaveBeenCalled();
    });

    it('should call setFailed if token exchange fails', async () => {
        const errorMessage = 'Token exchange failed miserably';
        mockedAxios.post.mockImplementation(() => { throw new mainModule.TokenExchangeError(errorMessage); });

        await expect(mainFunction()).rejects.toThrow(mainModule.TokenExchangeError);
        // The error message is double-wrapped by main's error handler
        expect(mockPlatformInstance.setFailed).toHaveBeenCalledWith(`Token exchange failed: Token exchange failed: ${errorMessage}`);
        expect(mockPlatformInstance.setOutput).not.toHaveBeenCalled();
    });

    it('should call setFailed if OCI configuration fails', async () => {
        const errorMessage = 'Could not write OCI config';
        // Mock fs.writeFile to throw, simulating a failure in configureOciCli
        mockedFs.writeFile.mockImplementation(() => { throw new Error(errorMessage); });

        await expect(mainFunction()).rejects.toThrow(Error);
        // The error handler calls setFailed twice with different messages, check both
        expect(mockPlatformInstance.setFailed).toHaveBeenNthCalledWith(1, expect.stringContaining('Failed to configure OCI CLI:'));
        expect(mockPlatformInstance.setFailed).toHaveBeenNthCalledWith(2, expect.stringContaining('Token exchange failed:'));
        expect(mockPlatformInstance.setOutput).not.toHaveBeenCalled();
    });

    it('should throw an error for an unsupported platform', async () => {
        process.env.PLATFORM = 'unsupported_platform';
        await expect(mainFunction()).rejects.toThrow('Unsupported platform: unsupported_platform');
    });

    it('should throw an error if a required input is missing', async () => {
        mockPlatformInstance.getInput.mockImplementation((name: string, required?: boolean) => {
            const inputs: { [key: string]: string } = {
                'oidc_client_identifier': 'test-client-id',
                'domain_base_url': 'https://auth.example.com',
                // 'oci_tenancy' is missing
                'oci_region': 'us-test-1',
            };
            const value = inputs[name] || '';
            if (required && !value) {
                throw new Error(`Input required and not supplied: ${name}`);
            }
            return value;
        });

        await expect(mainFunction()).rejects.toThrow('Input required and not supplied: oci_tenancy');
    });
});
